import { 
  collection, 
  addDoc, 
  query, 
  where,
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  limit
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';

export interface ScanResult {
  id?: string;
  userId: string;
  imageUrl: string;
  diseaseName: string;
  scientificName: string;
  confidence: number;
  description: string;
  proactiveAdvice: string;
  severity: number;
  timestamp: any;
}

const SCANS_PATH = 'analyses';

export async function saveScan(scan: Omit<ScanResult, 'id' | 'timestamp'>) {
  try {
    const docRef = await addDoc(collection(db, SCANS_PATH), {
      ...scan,
      timestamp: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, SCANS_PATH);
  }
}

export function subscribeToUserScans(userId: string, callback: (scans: ScanResult[]) => void) {
  const q = query(
    collection(db, SCANS_PATH), 
    where('userId', '==', userId),
    orderBy('timestamp', 'desc'),
    limit(20)
  );
  
  return onSnapshot(q, (snapshot) => {
    const scans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScanResult));
    callback(scans);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, SCANS_PATH);
  });
}

export function subscribeToGlobalScans(callback: (scans: ScanResult[]) => void) {
  const q = query(
    collection(db, SCANS_PATH), 
    orderBy('timestamp', 'desc'),
    limit(50)
  );
  
  return onSnapshot(q, (snapshot) => {
    const scans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScanResult));
    callback(scans);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, SCANS_PATH);
  });
}
