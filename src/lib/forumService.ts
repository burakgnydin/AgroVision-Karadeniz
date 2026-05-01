import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  deleteDoc,
  deleteField,
  increment
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './firebase';

export interface Post {
  id?: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  category: string;
  crop: string;
  imageUrl?: string;
  createdAt: any;
  likesCount: number;
}

export interface Comment {
  id?: string;
  postId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: any;
}

const POSTS_PATH = 'posts';

export async function createPost(post: Omit<Post, 'id' | 'createdAt' | 'likesCount'>) {
  try {
    const docRef = await addDoc(collection(db, POSTS_PATH), {
      ...post,
      createdAt: serverTimestamp(),
      likesCount: 0
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, POSTS_PATH);
  }
}

export function subscribeToPosts(callback: (posts: Post[]) => void) {
  const q = query(collection(db, POSTS_PATH), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
    callback(posts);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, POSTS_PATH);
  });
}

export async function addComment(postId: string, content: string, authorName: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("Yorum yapmak için giriş yapmalısınız.");
  
  const PATH = `posts/${postId}/comments`;
  try {
    await addDoc(collection(db, PATH), {
      postId,
      content,
      authorId: user.uid,
      authorName,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, PATH);
  }
}

export function subscribeToComments(postId: string, callback: (comments: Comment[]) => void) {
  const PATH = `posts/${postId}/comments`;
  const q = query(collection(db, PATH), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const comments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
    callback(comments);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, PATH);
  });
}

export async function likePost(postId: string) {
  const PATH = `${POSTS_PATH}/${postId}`;
  try {
    const postRef = doc(db, POSTS_PATH, postId);
    await updateDoc(postRef, {
      likesCount: increment(1)
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, PATH);
  }
}
