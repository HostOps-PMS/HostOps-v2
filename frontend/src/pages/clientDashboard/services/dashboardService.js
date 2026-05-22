/**
 * Dashboard-specific API calls.
 * Proxies from the shared apiService to keep the clientDashboard page self-contained.
 * Add new dashboard fetch logic here, hindi sa shared apiService.
 */
export { fetchDashboard, fetchMessages, sendReply } from '../../apiService';