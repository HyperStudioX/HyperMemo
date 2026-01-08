import {
    type FC,
    useEffect,
    useState
} from 'react';
import { useTranslation, Trans } from 'react-i18next';
import {
    Check,
    X,
    TrendingUp,
    Shield,
    Clock,
    CreditCard,
    Zap,
    Brain,
    FileText,
    MessageSquare,
    Sparkles
} from 'lucide-react';
import type { Subscription } from '@/types/subscription';
import { getUserSubscription } from '@/services/subscriptionService';
import { isProUser, getSubscriptionDaysRemaining, formatSubscriptionPeriod } from '@/types/subscription';
import { useAuth } from '@/contexts/AuthContext';

export const SubscriptionManager: FC = () => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadSubscription = async () => {
            if (user) {
                setLoading(true);
                const sub = await getUserSubscription(user.id);
                setSubscription(sub);
                setLoading(false);
            }
        };
        loadSubscription();
    }, [user]);

    const isPro = isProUser(subscription);
    const daysRemaining = getSubscriptionDaysRemaining(subscription);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
                <svg className="animate-spin w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <title>Loading</title>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                <span className="text-text-secondary">{t('subscription.loading')}</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 md:gap-10 animate-fade-in">
            {!isPro ? (
                <div className="relative overflow-hidden bg-white dark:bg-bg-subtle rounded-2xl p-6 md:p-8 border border-border shadow-sm">
                    {/* Decorative Background Element */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

                    <div className="relative flex flex-col md:flex-row md:justify-between md:items-start gap-6 mb-8">
                        <div className="flex-1">
                            <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold tracking-widest uppercase rounded-full mb-4">
                                Premium Experience
                            </span>
                            <h3 className="text-2xl md:text-3xl font-bold font-display text-text-primary">{t('subscription.upgradeTitle')}</h3>
                            <p className="text-text-secondary mt-2 whitespace-nowrap">{t('subscription.upgradeSubtitle')}</p>
                        </div>
                        <div className="flex flex-col items-start md:items-end">
                            <div className="flex items-baseline gap-1">
                                <span className="text-4xl font-bold text-text-primary">$4.99</span>
                                <span className="text-text-secondary font-medium">{t('subscription.perMonth')}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                        {[
                            { key: 'aiChat', icon: MessageSquare },
                            { key: 'aiNotes', icon: FileText },
                            { key: 'aiSummaries', icon: Sparkles }
                        ].map((feature) => (
                            <div key={feature.key} className="flex items-center gap-3 p-4 bg-bg-main rounded-xl border border-border/50">
                                <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                    <feature.icon size={20} />
                                </div>
                                <span className="text-sm font-medium text-text-primary">
                                    <Trans i18nKey={`subscription.table.${feature.key}`} />
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col gap-4">
                        <button className="w-full px-6 py-4 text-sm font-bold rounded-xl bg-primary text-white hover:bg-primary-hover transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 group" disabled type="button">
                            <Zap size={18} className="fill-current group-hover:animate-pulse" />
                            {t('subscription.upgradeTitle')} (Coming Soon)
                        </button>
                        <p className="text-center text-xs text-text-secondary flex items-center justify-center gap-2">
                            <Shield size={14} className="text-success" />
                            {t('subscription.securePayment')}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="bg-white dark:bg-bg-subtle rounded-2xl p-6 md:p-8 border border-success/30 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4">
                        <div className="flex items-center gap-2 px-3 py-1 bg-success/10 text-success rounded-full text-[10px] font-bold uppercase tracking-wider">
                            <Sparkles size={12} className="fill-current" />
                            {t('subscription.active')}
                        </div>
                    </div>

                    <div className="mb-8">
                        <h3 className="text-2xl font-bold font-display text-text-primary">{t('subscription.proActiveTitle')}</h3>
                        <p className="text-text-secondary mt-1">{t('subscription.proActiveSubtitle')}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        {[
                            { label: t('subscription.currentPeriod'), value: subscription ? formatSubscriptionPeriod(subscription) : '-', icon: Clock },
                            { label: t('subscription.status'), value: t('subscription.active'), valueClass: 'text-success font-bold', icon: Shield },
                            {
                                label: subscription?.cancelAtPeriodEnd ? t('subscription.endsOn') : t('subscription.renewsOn'),
                                value: subscription ? new Date(subscription.endDate).toLocaleDateString() : '-',
                                icon: Clock
                            },
                            { label: t('subscription.planCost'), value: `$4.99${t('subscription.perMonthLong')}`, icon: CreditCard }
                        ].map((stat) => (
                            <div key={stat.label} className="p-4 bg-bg-main rounded-xl border border-border/50">
                                <div className="flex items-center gap-2 text-text-secondary mb-2">
                                    {stat.icon && <stat.icon size={13} className="opacity-70" />}
                                    <span className="text-[10px] font-bold uppercase tracking-widest">{stat.label}</span>
                                </div>
                                <span className={`text-sm font-semibold text-text-primary ${stat.valueClass || ''}`}>{stat.value}</span>
                            </div>
                        ))}
                    </div>

                    {daysRemaining <= 7 && daysRemaining > 0 && (
                        <div className="flex items-center gap-3 px-4 py-3 bg-accent/10 border border-accent/20 text-accent-hover rounded-xl mb-6 text-sm font-medium">
                            <TrendingUp size={18} />
                            <span>{t('subscription.expiresIn', { days: daysRemaining })}</span>
                        </div>
                    )}

                    {subscription?.cancelAtPeriodEnd && (
                        <div className="flex items-center gap-3 px-4 py-3 bg-error/10 border border-error/20 text-error rounded-xl mb-6 text-sm font-medium">
                            <Clock size={18} />
                            <span>{t('subscription.wontRenew')}</span>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-3">
                        <button className="px-5 py-2.5 text-sm font-bold rounded-xl border border-border text-text-primary hover:bg-bg-active transition-all disabled:opacity-50 flex items-center justify-center gap-2" disabled type="button">
                            {t('subscription.manageBilling')}
                        </button>
                        {!subscription?.cancelAtPeriodEnd && (
                            <button className="px-5 py-2.5 text-sm font-bold rounded-xl text-error bg-error/5 hover:bg-error/10 border border-error/20 transition-all disabled:opacity-50" disabled type="button">
                                {t('subscription.cancelSubscription')}
                            </button>
                        )}
                    </div>
                </div>
            )}

            <div className="relative">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 px-1">
                    <h3 className="text-xl font-bold font-display text-text-primary">{t('subscription.planComparison')}</h3>
                </div>

                <div className="bg-white dark:bg-bg-subtle rounded-2xl border border-border shadow-sm overflow-hidden">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-bg-main/50 border-b border-border">
                                <th className="text-left px-6 py-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">{t('subscription.table.feature')}</th>
                                <th className="text-center px-6 py-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest w-24 md:w-32">{t('subscription.table.free')}</th>
                                <th className="text-center px-6 py-4 text-[10px] font-bold text-primary uppercase tracking-widest w-24 md:w-32">{t('subscription.table.pro')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {[
                                { key: 'aiSummaries', free: true, pro: true },
                                { key: 'aiTags', free: true, pro: true },
                                { key: 'aiChat', free: false, pro: true },
                                { key: 'aiNotes', free: false, pro: true }
                            ].map((feature) => (
                                <tr key={feature.key} className="group hover:bg-bg-main/50 transition-colors">
                                    <td className="px-6 py-4 text-sm font-medium text-text-primary group-hover:text-primary transition-colors">{t(`subscription.table.${feature.key}`)}</td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex justify-center">
                                            {feature.free ? (
                                                <div className="w-6 h-6 rounded-full bg-success/10 flex items-center justify-center">
                                                    <Check size={14} className="text-success" strokeWidth={3} />
                                                </div>
                                            ) : (
                                                <X size={16} className="text-text-secondary/30" />
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center bg-primary/2">
                                        <div className="flex justify-center">
                                            {feature.pro ? (
                                                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shadow-inner">
                                                    <Check size={16} className="text-primary" strokeWidth={3} />
                                                </div>
                                            ) : (
                                                <X size={16} className="text-text-secondary/60" />
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
