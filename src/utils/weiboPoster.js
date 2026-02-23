import { API_BASE_URL } from './api';

/**
 * Utility to post updates to Weibo system automatically
 * @param {string} content - The content of the post
 * @returns {Promise<boolean>} - Success status
 */
export const postToWeibo = async (content) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/weibo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      const data = await res.json();
      return data.success;
    } catch (e) {
      console.error('Failed to auto-post to weibo', e);
      return false;
    }
};