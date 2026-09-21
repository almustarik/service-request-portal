export const REQUEST_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
export const REQUEST_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const REQUEST_CATEGORIES = [
  'IT Support',
  'Facilities',
  'Finance',
  'HR',
  'Procurement',
  'Programme Operations',
  'Volunteer Coordination',
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export type RequestPriority = (typeof REQUEST_PRIORITIES)[number];
export type RequestCategory = (typeof REQUEST_CATEGORIES)[number];

export interface User {
  id: string;
  name: string;
  email: string;
}

/** Every activity row records who acted and what changed, so the timeline can be
 *  rendered without re-reading the request's current state. */
export type ActivityType = 'CREATED' | 'STATUS_CHANGED' | 'ASSIGNEE_CHANGED' | 'COMMENTED';

export interface Activity {
  id: string;
  requestId: string;
  type: ActivityType;
  actorId: string;
  actorName: string;
  createdAt: string;
  previousValue: string | null;
  newValue: string | null;
}

/** Only the detail view shows email addresses, so list rows carry the narrower
 *  shape the list query actually selects rather than padding out a full User. */
export type UserSummary = Pick<User, 'id' | 'name'>;

export interface ServiceRequestListItem {
  id: string;
  subject: string;
  requester: UserSummary;
  category: RequestCategory;
  priority: RequestPriority;
  status: RequestStatus;
  assignee: UserSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceRequestDetail extends Omit<
  ServiceRequestListItem,
  'requester' | 'assignee'
> {
  description: string;
  requester: User;
  assignee: User | null;
  activity: Activity[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
