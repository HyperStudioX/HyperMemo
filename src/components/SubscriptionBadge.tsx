import type React from 'react';
import { useTranslation } from 'react-i18next';
import type { Subscription } from '@/types/subscription';
import { isSubscriptionActive, getSubscriptionDaysRemaining, formatSubscriptionPeriod } from '@/types/subscription';
import './SubscriptionBadge.css';

interface SubscriptionBadgeProps {
    subscription: Subscription | null;
    showDetails?: boolean;
}

export const SubscriptionBadge: React.FC<SubscriptionBadgeProps> = ({ subscription, showDetails = false }) => {
    const { t } = useTranslation();

    if (!subscription) {
        return (
            <span className="subscription-badge subscription-badge--free">
                {t('subscription.badge.free')}
            </span>
        );
    }

    const isActive = isSubscriptionActive(subscription);
    const daysRemaining = getSubscriptionDaysRemaining(subscription);
    const isPro = subscription.tier === 'pro';

    const getBadgeClass = () => {
        if (!isPro) return 'subscription-badge--free';
        if (!isActive) return 'subscription-badge--expired';
        if (subscription.status === 'trial') return 'subscription-badge--trial';
        if (daysRemaining <= 7) return 'subscription-badge--expiring';
        return 'subscription-badge--pro';
    };

    const getBadgeText = () => {
        if (!isPro) return t('subscription.badge.free');
        if (!isActive) return t('subscription.badge.proExpired');
        if (subscription.status === 'trial') return t('subscription.badge.proTrial');
        return t('subscription.badge.pro');
    };

    const getStatusIcon = () => {
        if (!isPro) return '🆓';
        if (!isActive) return '⚠️';
        if (subscription.status === 'trial') return '🎁';
        if (daysRemaining <= 7) return '⏰';
        return '⭐';
    };

    return (
        <div className="subscription-badge-container">
            <span className={`subscription-badge ${getBadgeClass()}`}>
                <span className="subscription-badge__icon">{getStatusIcon()}</span>
                <span className="subscription-badge__text">{getBadgeText()}</span>
            </span>

            {showDetails && isPro && (
                <div className="subscription-details">
                    <div className="subscription-details__row">
                        <span className="subscription-details__label">{t('subscription.status')}</span>
                        <span className={`subscription-details__value ${isActive ? 'active' : 'inactive'}`}>
                            {isActive ? t('subscription.badge.active') : t('subscription.badge.expired')}
                        </span>
                    </div>

                    <div className="subscription-details__row">
                        <span className="subscription-details__label">{t('subscription.badge.period')}</span>
                        <span className="subscription-details__value">
                            {formatSubscriptionPeriod(subscription)}
                        </span>
                    </div>

                    {isActive && (
                        <div className="subscription-details__row">
                            <span className="subscription-details__label">{t('subscription.badge.daysRemaining')}</span>
                            <span className={`subscription-details__value ${daysRemaining <= 7 ? 'warning' : ''}`}>
                                {t('subscription.badge.days', { days: daysRemaining })}
                            </span>
                        </div>
                    )}

                    {subscription.cancelAtPeriodEnd && (
                        <div className="subscription-details__warning">
                            {t('subscription.badge.wontRenew')}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
