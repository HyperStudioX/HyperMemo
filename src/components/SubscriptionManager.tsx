import { type FC, useEffect, useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import type { Subscription } from '@/types/subscription';
import { getUserSubscription } from '@/services/subscriptionService';
import { isProUser, getSubscriptionDaysRemaining, formatSubscriptionPeriod } from '@/types/subscription';
import './SubscriptionManager.css';

const CheckIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#059669' }}>
        <title>Included</title>
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const XIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}>
        <title>Not Included</title>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

export const SubscriptionManager: FC = () => {
    const { t } = useTranslation();
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSubscription();
    }, []);

    const loadSubscription = async () => {
        setLoading(true);
        const sub = await getUserSubscription();
        setSubscription(sub);
        setLoading(false);
    };

    const isPro = isProUser(subscription);
    const daysRemaining = getSubscriptionDaysRemaining(subscription);

    if (loading) {
        return (
            <div className="subscription-manager">
                <div className="subscription-manager__loading">
                    <div className="spinner" />
                    <span>{t('subscription.loading')}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="subscription-manager">
            <div className="subscription-manager__content">
                {!isPro ? (
                    <div className="subscription-plan subscription-plan--pro">
                        <div className="subscription-plan__header">
                            <div>
                                <h3>{t('subscription.upgradeTitle')}</h3>
                                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{t('subscription.upgradeSubtitle')}</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <p className="subscription-plan__price">$4.99<span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{t('subscription.perMonth')}</span></p>
                            </div>
                        </div>

                        <div className="subscription-plan__features">
                            <h4>{t('subscription.whatsIncluded')}</h4>
                            <ul>
                                <li><CheckIcon /> <span><Trans i18nKey="subscription.features.aiChat" /></span></li>
                                <li><CheckIcon /> <span><Trans i18nKey="subscription.features.aiNotes" /></span></li>
                                <li><CheckIcon /> <span><Trans i18nKey="subscription.features.unlimitedBookmarks" /></span></li>
                                <li><CheckIcon /> <span><Trans i18nKey="subscription.features.prioritySupport" /></span></li>
                            </ul>
                        </div>

                        <button className="btn-upgrade" disabled type="button">
                            {t('subscription.upgradeTitle')}
                            <span className="badge-coming-soon">{t('subscription.comingSoon')}</span>
                        </button>
                        <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            {t('subscription.securePayment')}
                        </p>
                    </div>
                ) : (
                    <div className="subscription-plan subscription-plan--pro">
                        <div className="subscription-plan__header">
                            <div>
                                <h3>{t('subscription.proActiveTitle')}</h3>
                                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{t('subscription.proActiveSubtitle')}</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span className="status-pill status-pill--active">{t('subscription.active')}</span>
                            </div>
                        </div>

                        <div className="subscription-details-grid">
                            <div className="detail-item">
                                <span className="detail-label">{t('subscription.currentPeriod')}</span>
                                <span className="detail-value">{subscription ? formatSubscriptionPeriod(subscription) : '-'}</span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">{t('subscription.status')}</span>
                                <span className="detail-value" style={{ color: '#059669' }}>{t('subscription.active')}</span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">{t('subscription.nextBilling')}</span>
                                <span className="detail-value">
                                    {subscription?.cancelAtPeriodEnd ? t('subscription.endsOn') : t('subscription.renewsOn')}
                                    {subscription ? new Date(subscription.endDate).toLocaleDateString() : '-'}
                                </span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">{t('subscription.planCost')}</span>
                                <span className="detail-value">$4.99{t('subscription.perMonthLong')}</span>
                            </div>
                        </div>

                        {daysRemaining <= 7 && daysRemaining > 0 && (
                            <div className="subscription-warning">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <title>Warning</title>
                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                    <line x1="12" y1="9" x2="12" y2="13" />
                                    <line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                                <span>{t('subscription.expiresIn', { days: daysRemaining })}</span>
                            </div>
                        )}

                        {subscription?.cancelAtPeriodEnd && (
                            <div className="subscription-warning">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <title>Info</title>
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                <span>{t('subscription.wontRenew')}</span>
                            </div>
                        )}

                        <div className="subscription-actions">
                            <button className="btn-secondary" disabled type="button">
                                {t('subscription.manageBilling')}
                                <span className="badge-coming-soon">{t('subscription.comingSoon')}</span>
                            </button>
                            {!subscription?.cancelAtPeriodEnd && (
                                <button className="btn-danger" disabled type="button">
                                    {t('subscription.cancelSubscription')}
                                    <span className="badge-coming-soon">{t('subscription.comingSoon')}</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}

                <div className="subscription-comparison">
                    <h3>{t('subscription.planComparison')}</h3>
                    <table className="comparison-table">
                        <thead>
                            <tr>
                                <th>{t('subscription.table.feature')}</th>
                                <th>{t('subscription.table.free')}</th>
                                <th>{t('subscription.table.pro')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>{t('subscription.table.bookmarks')}</td>
                                <td>{t('subscription.table.unlimited')}</td>
                                <td>{t('subscription.table.unlimited')}</td>
                            </tr>
                            <tr>
                                <td>{t('subscription.table.aiSummaries')}</td>
                                <td><CheckIcon /></td>
                                <td><CheckIcon /></td>
                            </tr>
                            <tr>
                                <td>{t('subscription.table.aiTags')}</td>
                                <td><CheckIcon /></td>
                                <td><CheckIcon /></td>
                            </tr>
                            <tr>
                                <td>{t('subscription.table.aiChat')}</td>
                                <td><XIcon /></td>
                                <td><CheckIcon /></td>
                            </tr>
                            <tr>
                                <td>{t('subscription.table.aiNotes')}</td>
                                <td><XIcon /></td>
                                <td><CheckIcon /></td>
                            </tr>
                            <tr>
                                <td>{t('subscription.table.support')}</td>
                                <td>{t('subscription.table.community')}</td>
                                <td>{t('subscription.table.priority')}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
