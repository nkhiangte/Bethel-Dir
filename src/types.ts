import { Timestamp } from 'firebase/firestore';

export interface Resident {
  id?: string;
  name: string;
  houseNumber: string;
  block: string;
  phoneNumber: string;
  landmark: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface UserProfile {
  email: string;
  role: 'admin' | 'user';
}
