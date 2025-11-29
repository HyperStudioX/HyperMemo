from __future__ import annotations

import json
import logging
import math
import os
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Tuple

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import firestore
from firebase_admin.exceptions import FirebaseError
from firebase_functions import https_fn
from flask import Response
from openai import OpenAI

try:
    import vertexai
    from vertexai.language_models import TextEmbeddingModel
    from vertexai.preview.generative_models import GenerativeModel
except ImportError:  # pragma: no cover - vertexai is optional at import time
    vertexai = None
    TextEmbeddingModel = None  # type: ignore[assignment]
    GenerativeModel = None  # type: ignore[assignment]


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
if cred_path and not os.path.exists(cred_path):
    logger.warning(
        "GOOGLE_APPLICATION_CREDENTIALS points to %s but the file does not exist; falling back to ADC",
        cred_path,
    )
    os.environ.pop("GOOGLE_APPLICATION_CREDENTIALS", None)

if not firebase_admin._apps:
    firebase_admin.initialize_app()

firestore_client = firestore.client()
auth_client = firebase_auth

project_id = os.environ.get("GCP_PROJECT") or os.environ.get("GCLOUD_PROJECT") or os.environ.get(
    "GOOGLE_CLOUD_PROJECT"
)
if not project_id and os.environ.get("FIREBASE_CONFIG"):
    try:
        project_id = json.loads(os.environ["FIREBASE_CONFIG"]).get("projectId")
    except json.JSONDecodeError:
        logger.warning("Failed to parse FIREBASE_CONFIG for project id")

AI_PROVIDER = (os.environ.get("AI_PROVIDER") or "openai").strip().lower()
REQUIRE_AUTH = not bool(
    os.environ.get("REQUIRE_AUTH", "true").lower() in {"0", "false", "no", "off"}
)
ANON_UID = os.environ.get("ANON_UID", "dev-anon")
VERTEX_LOCATION = os.environ.get("VERTEX_LOCATION", "asia-northeast1")
VERTEX_GEN_MODEL = os.environ.get("VERTEX_SUMMARY_MODEL", "gemini-1.5-pro-latest")
VERTEX_EMBED_MODEL = os.environ.get("VERTEX_EMBED_MODEL", "text-embedding-004")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
OPENAI_GEN_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o")
OPENAI_EMBED_MODEL = os.environ.get("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")

vertex_gen_model: Optional[GenerativeModel] = None
vertex_embed_model: Optional[TextEmbeddingModel] = None
openai_client: Optional[OpenAI] = None

if AI_PROVIDER == "vertex":
    if not project_id:
        raise RuntimeError("Missing GCP project id for Vertex AI.")
    if vertexai is None:
        raise RuntimeError("vertexai package is not available but AI_PROVIDER=vertex")
    vertexai.init(project=project_id, location=VERTEX_LOCATION)
    vertex_gen_model = GenerativeModel(VERTEX_GEN_MODEL)
    try:
        vertex_embed_model = TextEmbeddingModel.from_pretrained(VERTEX_EMBED_MODEL)
    except Exception as exc:  # pragma: no cover - depends on Vertex SDK availability
        logger.warning("Vertex embedding model init failed: %s", exc)
        vertex_embed_model = None
elif AI_PROVIDER == "openai":
    if OPENAI_API_KEY:
        openai_client = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_BASE_URL)
    else:
        logger.warning(
            "AI_PROVIDER is 'openai' but OPENAI_API_KEY is not set. Generative features will fail.",
        )
else:
    raise RuntimeError(f"Unsupported AI_PROVIDER: {AI_PROVIDER}")

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
}


def _json_default(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def json_response(status: int, payload: Any) -> Response:
    body = json.dumps(payload, default=_json_default)
    headers = {**CORS_HEADERS, "Content-Type": "application/json"}
    return Response(body, status=status, headers=headers)


def handle_cors(req: https_fn.Request) -> Optional[Response]:
    if req.method == "OPTIONS":
        return Response("", status=204, headers=CORS_HEADERS)
    return None


def parse_body(req: https_fn.Request) -> Dict[str, Any]:
    if req.is_json:
        data = req.get_json(silent=True)
        if isinstance(data, dict):
            return data
    raw = getattr(req, "data", b"") or b""
    if raw:
        if isinstance(raw, bytes):
            raw_text = raw.decode("utf-8", "ignore")
        else:
            raw_text = str(raw)
        try:
            parsed = json.loads(raw_text)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass
    return {}


def verify_user(req: https_fn.Request) -> str:
    if not REQUIRE_AUTH:
        return ANON_UID
    auth_header = (req.headers.get("Authorization") or "").strip()
    if not auth_header.startswith("Bearer "):
        logger.warning("Missing or invalid Authorization header format")
        raise PermissionError("Missing Authorization header")
    id_token = auth_header[len("Bearer ") :]
    if not id_token:
        logger.warning("Empty token in Authorization header")
        raise PermissionError("Empty token")
    try:
        # Try without revocation check first (faster, less network calls)
        decoded = auth_client.verify_id_token(id_token, check_revoked=False)
        uid = decoded.get("uid")
        if not uid:
            logger.warning("Token decoded but missing uid field")
            raise PermissionError("Invalid token: missing uid")
        logger.debug("Token verified for uid: %s", uid)
        return uid
    except ValueError as exc:
        logger.warning("Invalid token format: %s", exc)
        raise PermissionError("Invalid token format") from exc
    except FirebaseError as exc:
        logger.warning("Token verification failed: %s (code: %s)", exc, getattr(exc, "code", "unknown"))
        raise PermissionError(f"Token verification failed: {exc}") from exc
    except Exception as exc:
        logger.exception("Unexpected error during token verification: %s", type(exc).__name__)
        raise PermissionError("Token verification failed") from exc


def summarize_prompt(title: str, content: str, url: str) -> str:
    parts = ["You are HyperMemo, a concise research assistant."]
    if title:
        parts.append(f"Title: {title}")
    if url:
        parts.append(f"URL: {url}")
    parts.append("Content:")
    parts.append(content[:8000])
    return "\n".join(parts)


def tags_prompt(title: str, content: str) -> str:
    return "\n".join(
        [
            "Suggest up to 5 concise tags (single words) describing the following page. Return comma-separated words only.",
            f"Title: {title}",
            "Content:",
            content[:4000],
        ],
    )


def generate_content(prompt: str) -> str:
    if AI_PROVIDER == "vertex":
        if not vertex_gen_model:
            raise RuntimeError("Vertex generative model not configured.")
        response = vertex_gen_model.generate_content(prompt)
        text = getattr(response, "text", None)
        if isinstance(text, str) and text.strip():
            return text.strip()
        candidates = getattr(response, "candidates", []) or []
        parts: List[str] = []
        for candidate in candidates:
            content = getattr(candidate, "content", None)
            if not content:
                continue
            for part in getattr(content, "parts", []) or []:
                value = getattr(part, "text", "")
                if isinstance(value, str):
                    parts.append(value)
        return "".join(parts).strip()
    if not openai_client:
        raise RuntimeError("OpenAI client is not configured.")
    completion = openai_client.chat.completions.create(
        model=OPENAI_GEN_MODEL,
        messages=[{"role": "user", "content": prompt}],
    )
    choice = (completion.choices or [None])[0]
    if not choice:
        return ""
    content = getattr(choice.message, "content", "")
    return (content or "").strip()


def embed_text(text: str) -> List[float]:
    trimmed = (text or "").strip()
    if not trimmed:
        return []
    if AI_PROVIDER == "vertex":
        if not vertex_embed_model:
            raise RuntimeError("Vertex embedding model not configured.")
        embeddings = vertex_embed_model.get_embeddings([trimmed])
        if not embeddings:
            return []
        values = getattr(embeddings[0], "values", []) or []
        return [float(value) for value in values]
    if not openai_client:
        raise RuntimeError("OpenAI client is not configured.")
    clean = trimmed.replace("\n", " ")
    response = openai_client.embeddings.create(model=OPENAI_EMBED_MODEL, input=[clean])
    data = response.data or []
    if not data:
        return []
    return [float(value) for value in data[0].embedding]


def cosine_similarity(a: Iterable[float], b: Iterable[float]) -> float:
    a_list = list(a)
    b_list = list(b)
    if not a_list or not b_list:
        return 0.0
    length = min(len(a_list), len(b_list))
    dot = 0.0
    norm_a = 0.0
    norm_b = 0.0
    for idx in range(length):
        av = float(a_list[idx])
        bv = float(b_list[idx])
        dot += av * bv
        norm_a += av * av
        norm_b += bv * bv
    if not norm_a or not norm_b:
        return 0.0
    return dot / (math.sqrt(norm_a) * math.sqrt(norm_b))


def extract_doc(doc: Any) -> Dict[str, Any]:
    data = doc.to_dict() or {}
    data["id"] = doc.id
    return data


def build_sources_text(matches: List[Dict[str, Any]]) -> str:
    lines: List[str] = []
    for index, match in enumerate(matches, start=1):
        bookmark = match.get("bookmark", {})
        title = bookmark.get("title") or "Untitled"
        summary = bookmark.get("summary") or ""
        lines.append(f"[{index}] {title} — {summary}")
    return "\n".join(lines)


def ensure_collection(uid: str):
    return firestore_client.collection("users").document(uid).collection("bookmarks")


def parse_tags(raw: str) -> List[str]:
    return [tag.strip().lower() for tag in raw.split(",") if tag.strip()][:5]


def bookmark_payload(payload: Dict[str, Any]) -> Tuple[str, str, str, str, str]:
    title = (payload.get("title") or "").strip()
    url = (payload.get("url") or "").strip()
    summary = (payload.get("summary") or "").strip()
    note = (payload.get("note") or "").strip()
    raw_content = (payload.get("rawContent") or "").strip()
    return title, url, summary, note, raw_content


def ensure_summary(title: str, raw_content: str, url: str, summary: str) -> str:
    if summary or not raw_content:
        return summary
    prompt = summarize_prompt(title, raw_content, url)
    return generate_content(prompt)


def ensure_tags(title: str, raw_content: str, tags: List[str]) -> List[str]:
    if tags or not raw_content:
        return tags
    prompt = tags_prompt(title, raw_content)
    text = generate_content(prompt)
    return parse_tags(text)


def compute_embedding(parts: List[str]) -> List[float]:
    source = "\n".join(part for part in parts if isinstance(part, str) and part.strip())
    if not source:
        return []
    return embed_text(source)


def handle_bookmarks_request(req: https_fn.Request) -> Response:
    cors = handle_cors(req)
    if cors:
        return cors
    try:
        uid = verify_user(req)
        if req.method == "GET":
            query = (
                ensure_collection(uid)
                .order_by("createdAt", direction=firestore.Query.DESCENDING)
                .limit(100)
            )
            docs = [extract_doc(doc) for doc in query.stream()]
            return json_response(200, docs)
        if req.method not in {"POST", "PUT"}:
            return json_response(405, {"error": "Method not allowed"})
        payload = parse_body(req)
        title, url, summary, note, raw_content = bookmark_payload(payload)
        if not title or not url:
            return json_response(400, {"error": "title and url are required"})
        summary = ensure_summary(title, raw_content, url, summary)
        tags_input = payload.get("tags")
        tags: List[str]
        if isinstance(tags_input, list):
            tags = [str(tag).strip().lower() for tag in tags_input if str(tag).strip()][:5]
        else:
            tags = []
        tags = ensure_tags(title, raw_content, tags)
        embedding = compute_embedding([title, summary, note, raw_content])
        collection = ensure_collection(uid)
        doc_id = payload.get("id") or collection.document().id
        doc_ref = collection.document(doc_id)
        record: Dict[str, Any] = {
            "title": title,
            "url": url,
            "tags": tags,
            "summary": summary,
            "note": note,
            "rawContent": raw_content,
            "embedding": embedding,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }
        if not payload.get("id"):
            record["createdAt"] = firestore.SERVER_TIMESTAMP
        doc_ref.set(record, merge=True)
        saved = doc_ref.get()
        return json_response(200, extract_doc(saved))
    except PermissionError as exc:
        return json_response(401, {"error": str(exc)})
    except Exception as exc:  # pragma: no cover - network/SDK errors
        logger.exception("bookmarks handler failed")
        return json_response(500, {"error": str(exc)})


def handle_summaries_request(req: https_fn.Request) -> Response:
    cors = handle_cors(req)
    if cors:
        return cors
    try:
        verify_user(req)
        payload = parse_body(req)
        title = payload.get("title", "")
        content = payload.get("content", "")
        url = payload.get("url", "")
        summary = generate_content(summarize_prompt(str(title), str(content), str(url)))
        return json_response(200, {"summary": summary})
    except PermissionError as exc:
        return json_response(401, {"error": str(exc)})
    except Exception as exc:  # pragma: no cover
        logger.exception("summaries handler failed")
        return json_response(500, {"error": str(exc)})


def handle_summary_tags_request(req: https_fn.Request) -> Response:
    cors = handle_cors(req)
    if cors:
        return cors
    try:
        verify_user(req)
        payload = parse_body(req)
        title = str(payload.get("title", ""))
        content = str(payload.get("content", ""))
        text = generate_content(tags_prompt(title, content))
        return json_response(200, {"tags": parse_tags(text)})
    except PermissionError as exc:
        return json_response(401, {"error": str(exc)})
    except Exception as exc:  # pragma: no cover
        logger.exception("summary_tags handler failed")
        return json_response(500, {"error": str(exc)})


def handle_rag_query_request(req: https_fn.Request) -> Response:
    cors = handle_cors(req)
    if cors:
        return cors
    try:
        uid = verify_user(req)
        payload = parse_body(req)
        question = (payload.get("question") or "").strip()
        if len(question) < 3:
            return json_response(400, {"error": "Question is too short"})
        query_vector = embed_text(question)
        snapshot = ensure_collection(uid).where("embedding", "!=", None).stream()
        matches: List[Dict[str, Any]] = []
        for doc in snapshot:
            data = extract_doc(doc)
            embedding = data.get("embedding") or []
            if not isinstance(embedding, list):
                continue
            score = cosine_similarity(query_vector, embedding)
            if score <= 0:
                continue
            matches.append({"bookmark": data, "score": score})
        matches.sort(key=lambda item: item["score"], reverse=True)
        matches = matches[:5]
        prompt = "\n".join(
            [
                "You are HyperMemo. Answer the question using ONLY the provided sources. Cite sources with [S#].",
                f"Question: {question}",
                "Sources:",
                build_sources_text(matches),
            ]
        )
        answer = generate_content(prompt)
        return json_response(200, {"answer": answer, "matches": matches})
    except PermissionError as exc:
        return json_response(401, {"error": str(exc)})
    except Exception as exc:  # pragma: no cover
        logger.exception("rag_query handler failed")
        return json_response(500, {"error": str(exc)})


@https_fn.on_request(memory=512)
def bookmarks(req: https_fn.Request) -> Response:
    return handle_bookmarks_request(req)


@https_fn.on_request(memory=512)
def summaries(req: https_fn.Request) -> Response:
    return handle_summaries_request(req)


@https_fn.on_request(memory=512)
def summary_tags(req: https_fn.Request) -> Response:
    return handle_summary_tags_request(req)


@https_fn.on_request(memory=512)
def rag_query(req: https_fn.Request) -> Response:
    return handle_rag_query_request(req)
