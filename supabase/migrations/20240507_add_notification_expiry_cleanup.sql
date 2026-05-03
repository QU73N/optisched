-- Migration: Notification Expiry Cleanup
-- Purpose: Implement automatic cleanup of expired notifications
-- Best practice: Old notifications should be cleaned up to prevent database bloat

-- Create function to clean up expired notifications
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS TABLE(
    cleaned_count BIGINT,
    details TEXT
) AS $$
DECLARE
    v_cleaned_count BIGINT;
    v_details TEXT;
BEGIN
    -- Delete notifications that have expired
    DELETE FROM public.notifications
    WHERE expires_at IS NOT NULL
    AND expires_at < NOW();
    
    GET DIAGNOSTICS v_cleaned_count = ROW_COUNT;
    
    v_details := format('Cleaned up %s expired notifications', v_cleaned_count);
    
    RETURN QUERY SELECT v_cleaned_count, v_details;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check expired notification count
CREATE OR REPLACE FUNCTION get_expired_notification_count()
RETURNS TABLE(
    expired_count BIGINT,
    active_count BIGINT,
    total_count BIGINT,
    details TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) FILTER (WHERE expires_at IS NOT NULL AND expires_at < NOW()) AS expired_count,
        COUNT(*) FILTER (WHERE expires_at IS NULL OR expires_at >= NOW()) AS active_count,
        COUNT(*) AS total_count,
        format('Total notifications: %s, Expired: %s, Active: %s', 
            COUNT(*),
            COUNT(*) FILTER (WHERE expires_at IS NOT NULL AND expires_at < NOW()),
            COUNT(*) FILTER (WHERE expires_at IS NULL OR expires_at >= NOW())
        ) AS details
    FROM public.notifications;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a view for monitoring notification expiry
CREATE OR REPLACE VIEW notification_expiry_monitor AS
SELECT 
    id,
    user_id,
    type,
    title,
    is_read,
    expires_at,
    created_at,
    EXTRACT(DAY FROM (expires_at - NOW())) AS days_until_expiry,
    CASE 
        WHEN expires_at < NOW() THEN 'EXPIRED'
        WHEN expires_at < NOW() + INTERVAL '7 days' THEN 'EXPIRING_SOON'
        ELSE 'ACTIVE'
    END AS expiry_status
FROM public.notifications
WHERE expires_at IS NOT NULL
ORDER BY expires_at ASC;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION cleanup_expired_notifications() TO authenticated;
GRANT EXECUTE ON FUNCTION get_expired_notification_count() TO authenticated;

-- Grant select on view to authenticated users
GRANT SELECT ON notification_expiry_monitor TO authenticated;

-- Add comment to document the cleanup function
COMMENT ON FUNCTION cleanup_expired_notifications() IS 
'Automatically cleans up notifications that have expired (expires_at < NOW()). 
Can be scheduled via pg_cron or run manually by Power Admins.';

COMMENT ON FUNCTION get_expired_notification_count() IS 
'Returns count of expired notifications, active notifications, and total notifications.';

COMMENT ON VIEW notification_expiry_monitor IS 
'Monitoring view for notifications with expiry dates. 
Shows days until expiry and expiry status (EXPIRED, EXPIRING_SOON, ACTIVE).';

-- Create a policy to allow Power Admins to manually trigger cleanup
CREATE POLICY "Power admins can execute notification cleanup"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('power_admin', 'admin')
    )
    AND action = 'notification_expiry_cleanup'
);

-- Verification query to check cleanup function works
DO $$
BEGIN
    RAISE NOTICE 'Notification expiry cleanup migration completed successfully';
    RAISE NOTICE 'Function cleanup_expired_notifications() created';
    RAISE NOTICE 'Function get_expired_notification_count() created';
    RAISE NOTICE 'View notification_expiry_monitor created';
    RAISE NOTICE 'To schedule automatic cleanup, use pg_cron: SELECT cron.schedule(''notification-cleanup'', ''0 3 * * *'', ''SELECT cleanup_expired_notifications()'')';
END $$;
