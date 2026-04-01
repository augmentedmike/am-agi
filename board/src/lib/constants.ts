/** Fixed project ID for the AM Board project itself. Never null. */
export const AM_BOARD_PROJECT_ID = 'am-board-0000-0000-0000-000000000000';

/** Template types that are content/social projects — calendar view is enabled for these. */
export const CONTENT_TEMPLATE_TYPES = new Set([
  'content-marketing',
  'knowledge-base',
  'community',
  'pr-outreach',
]);

/** Template categories for the project selector. */
export const TEMPLATE_CATEGORIES = [
  { label: 'Software', templateType: 'software' },
  { label: 'Sales',    templateType: 'sales-outbound' },
  { label: 'Support',  templateType: 'customer-support' },
  { label: 'Content',  templateType: 'content-marketing' },
] as const;
