import React, { useState, useEffect, useMemo, Component, ReactNode } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  setDoc,
  getDoc,
  serverTimestamp,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  Phone, 
  MessageCircle, 
  LogOut, 
  LogIn, 
  User as UserIcon,
  X,
  Save,
  Loader2,
  PhoneCall,
  FileUp,
  SortDesc,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { read, utils, writeFileXLSX } from 'xlsx';
import { auth, db, handleFirestoreError, OperationType, isFirestoreConnected, firestoreConnectionError } from './firebase';
import { Resident, UserProfile } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Error Boundary Component
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends (Component as any) {
  state = { hasError: false, error: null };

  constructor(props: any) {
    super(props);
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-blue-950 p-4">
          <div className="max-w-md w-full bg-blue-900 rounded-2xl shadow-xl p-8 text-center border border-blue-800">
            <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <X className="w-8 h-8 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-blue-400 mb-6">
              {(this.state as any).error?.message || "An unexpected error occurred."}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return (this.props as any).children;
  }
}

interface ResidentCardProps {
  resident: Resident;
  isAdmin: boolean;
  onEdit: (r: Resident) => void;
  onDelete: (id: string) => Promise<void> | void;
}

const ResidentCard: React.FC<ResidentCardProps> = ({ 
  resident, 
  isAdmin, 
  onEdit, 
  onDelete 
}) => {
  const handleWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-blue-900 rounded-2xl border border-blue-800 p-5 hover:border-indigo-500/50 transition-all group relative"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">{resident.name}</h3>
          <p className="text-sm text-blue-400 font-medium">House No: {resident.houseNumber}</p>
        </div>
        <div className="bg-indigo-500/10 text-indigo-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
          Block {resident.block}
        </div>
      </div>

      <div className="flex items-center gap-3 text-blue-300 mb-2">
        <Phone className="w-4 h-4 text-indigo-400" />
        <span className="text-sm font-medium tracking-wide">{resident.phoneNumber}</span>
      </div>

      {resident.landmark && (
        <div className="flex items-center gap-3 text-blue-500 mb-6">
          <div className="w-4 h-4 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/50" />
          </div>
          <span className="text-xs italic tracking-wide">Near {resident.landmark}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button 
          onClick={() => handleCall(resident.phoneNumber)}
          className="flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors active:scale-95"
        >
          <PhoneCall className="w-4 h-4" />
          Call
        </button>
        <button 
          onClick={() => handleWhatsApp(resident.phoneNumber)}
          className="flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors active:scale-95"
        >
          <MessageCircle className="w-4 h-4" />
          WhatsApp
        </button>
      </div>

      {isAdmin && (
        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={() => onEdit(resident)}
            className="p-2 bg-blue-800/80 backdrop-blur-sm border border-blue-700 rounded-lg text-blue-300 hover:text-indigo-400 hover:border-indigo-500/50 transition-all"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => resident.id && onDelete(resident.id)}
            className="p-2 bg-blue-800/80 backdrop-blur-sm border border-blue-700 rounded-lg text-blue-300 hover:text-red-400 hover:border-red-500/50 transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </motion.div>
  );
};

const ResidentForm = ({ 
  resident, 
  onClose, 
  onSave 
}: { 
  resident?: Resident, 
  onClose: () => void, 
  onSave: (data: Partial<Resident>) => void 
}) => {
  const [formData, setFormData] = useState({
    name: resident?.name || '',
    houseNumber: resident?.houseNumber || '',
    block: resident?.block || '',
    phoneNumber: resident?.phoneNumber || '',
    landmark: resident?.landmark || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-blue-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-blue-800"
      >
        <div className="px-8 pt-8 pb-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">
              {resident ? 'Edit Resident' : 'Add Resident'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-blue-800 rounded-full transition-colors">
              <X className="w-6 h-6 text-blue-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-blue-500 uppercase tracking-widest mb-2 ml-1">Full Name</label>
              <input 
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 bg-blue-800 border border-blue-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-blue-800 text-white transition-all outline-none"
                placeholder="e.g. Lalramchhana"
              />
            </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-blue-500 uppercase tracking-widest mb-2 ml-1">House No</label>
                  <input 
                    required
                    value={formData.houseNumber}
                    onChange={e => setFormData({ ...formData, houseNumber: e.target.value })}
                    className="w-full px-4 py-3 bg-blue-800 border border-blue-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-blue-800 text-white transition-all outline-none"
                    placeholder="e.g. B-42"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-blue-500 uppercase tracking-widest mb-2 ml-1">Block (Optional)</label>
                  <input 
                    value={formData.block}
                    onChange={e => setFormData({ ...formData, block: e.target.value })}
                    className="w-full px-4 py-3 bg-blue-800 border border-blue-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-blue-800 text-white transition-all outline-none"
                    placeholder="e.g. 1"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-blue-500 uppercase tracking-widest mb-2 ml-1">Phone Number (Optional)</label>
                <input 
                  value={formData.phoneNumber}
                  onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
                  className="w-full px-4 py-3 bg-blue-800 border border-blue-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-blue-800 text-white transition-all outline-none"
                  placeholder="e.g. 9876543210"
                />
              </div>

            <div>
              <label className="block text-xs font-bold text-blue-500 uppercase tracking-widest mb-2 ml-1">Landmark (Optional)</label>
              <input 
                value={formData.landmark}
                onChange={e => setFormData({ ...formData, landmark: e.target.value })}
                className="w-full px-4 py-3 bg-blue-800 border border-blue-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-blue-800 text-white transition-all outline-none"
                placeholder="e.g. Near Baptist Church"
              />
            </div>

            <button 
              type="submit"
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 flex items-center justify-center gap-2 mt-4"
            >
              <Save className="w-5 h-5" />
              {resident ? 'Update Entry' : 'Create Entry'}
            </button>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
};

function DirectoryApp() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [search, setSearch] = useState('');
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingResident, setEditingResident] = useState<Resident | undefined>();
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'houseNumber'>('name');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            setUserProfile(userDoc.data() as UserProfile);
          } else {
            // Create default user profile
            const newProfile: UserProfile = {
              email: currentUser.email || '',
              role: 'user'
            };
            await setDoc(doc(db, 'users', currentUser.uid), newProfile);
            setUserProfile(newProfile);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
        }
      } else {
        setUserProfile(null);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady) {
      setResidents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'residents_v1'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Resident[];
      setResidents(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'residents_v1');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAuthReady]);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        console.log("User closed the login popup.");
      } else if (error.code === 'auth/cancelled-popup-request') {
        console.log("Popup request cancelled.");
      } else {
        console.error("Login failed:", error);
        alert("Login failed: " + (error.message || "Unknown error"));
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          alert("The file is empty.");
          return;
        }

        if (!window.confirm(`Are you sure you want to import ${data.length} entries?`)) return;

        setLoading(true);
        const batch = writeBatch(db);
        const residentsRef = collection(db, 'residents_v1');
        let count = 0;

        data.forEach((row) => {
          const name = String(row.name || row.Name || '').trim();
          const houseNumber = String(row.houseNumber || row.HouseNumber || row['House No'] || '').trim();
          const block = String(row.block || row.Block || '').trim();
          const phoneNumber = String(row.phoneNumber || row.PhoneNumber || row['Phone Number'] || row.Phone || '').trim();
          const landmark = String(row.landmark || row.Landmark || '').trim();

          // Skip rows without a name or house number
          if (!name || !houseNumber) {
            console.warn("Skipping row due to missing required fields (Name/House No):", row);
            return; 
          }

          const newDocRef = doc(residentsRef);
          batch.set(newDocRef, {
            name: name,
            houseNumber: houseNumber,
            block: block,
            phoneNumber: phoneNumber,
            landmark: landmark,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: user.uid
          });
          count++;
        });

        if (count === 0) {
          alert("No valid entries found to import. Please ensure the Excel file has columns for Name and House No.");
          setLoading(false);
          return;
        }

        await batch.commit();
        alert(`Successfully imported ${count} entries!`);
      } catch (error: any) {
        console.error("Import failed:", error);
        if (error.code === 'permission-denied') {
          // Check if the user is actually an admin client-side
          if (isAdmin) {
            alert("Import failed: Data validation error. Please check that all required fields are present and follow the correct format.");
          } else {
            alert("Import failed: You don't have permission to perform this action. Please make sure you are logged in as an admin.");
          }
        } else {
          alert("Import failed: " + (error.message || "Please check the file format."));
        }
      } finally {
        setLoading(false);
        e.target.value = ''; // Reset input
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        name: "Lalramchhana",
        houseNumber: "B-42",
        block: "1",
        phoneNumber: "9876543210",
        landmark: "Near Baptist Church"
      },
      {
        name: "Zoramthanga",
        houseNumber: "C-15",
        block: "2",
        phoneNumber: "9123456789",
        landmark: "Opposite Primary School"
      }
    ];

    const ws = utils.json_to_sheet(templateData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Residents Template");
    writeFileXLSX(wb, "Bethel_Veng_Directory_Template.xlsx");
  };

  const handleSaveResident = async (data: Partial<Resident>) => {
    if (!user) return;

    try {
      if (editingResident?.id) {
        await updateDoc(doc(db, 'residents_v1', editingResident.id), {
          ...data,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'residents_v1'), {
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: user.uid
        });
      }
      setIsFormOpen(false);
      setEditingResident(undefined);
    } catch (error) {
      handleFirestoreError(error, editingResident ? OperationType.UPDATE : OperationType.CREATE, 'residents_v1');
    }
  };

  const handleDeleteResident = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this entry?")) return;
    try {
      await deleteDoc(doc(db, 'residents_v1', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `residents_v1/${id}`);
    }
  };

  const filteredResidents = useMemo(() => {
    const term = search.toLowerCase();
    const filtered = residents.filter(r => 
      r.name.toLowerCase().includes(term) || 
      r.houseNumber.toLowerCase().includes(term) ||
      r.block.toLowerCase().includes(term) ||
      r.phoneNumber.includes(term) ||
      (r.landmark && r.landmark.toLowerCase().includes(term))
    );

    return filtered.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else {
        return a.houseNumber.localeCompare(b.houseNumber, undefined, { numeric: true });
      }
    });
  }, [residents, search, sortBy]);

  const isAdmin = userProfile?.role === 'admin' || user?.email === 'nkhiangte@gmail.com';

  if (firestoreConnectionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-950 p-4">
        <div className="max-w-md w-full bg-blue-900 rounded-2xl shadow-xl p-8 text-center border border-blue-800">
          <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <X className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Connection Error</h1>
          <p className="text-blue-400 mb-6">
            {firestoreConnectionError.includes('the client is offline') 
              ? "Please check your Firebase configuration. The application is unable to reach the Firestore database."
              : `Firestore connection test failed: ${firestoreConnectionError}`}
          </p>
          <div className="text-left bg-blue-950 p-4 rounded-xl mb-6 overflow-auto max-h-40 border border-blue-800">
            <p className="text-xs font-mono text-blue-500 break-all">
              Project ID: {auth.app.options.projectId}<br/>
              Auth Domain: {auth.app.options.authDomain}
            </p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-950">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-950 pb-20 text-white">
      {/* Header */}
      <header className="bg-blue-900 border-b border-blue-800 sticky top-0 z-40 backdrop-blur-md bg-blue-900/80">
        <div className="max-w-4xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <UserIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight leading-none mb-1">Bethel Veng</h1>
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Champhai Directory</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-bold text-white">{user.displayName}</p>
                  <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">{userProfile?.role}</p>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2.5 bg-blue-800 text-blue-400 hover:text-red-400 hover:bg-red-900/20 rounded-xl transition-all active:scale-95"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </>
            ) : (
              <button 
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 text-indigo-400 rounded-xl font-bold text-sm hover:bg-indigo-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingIn ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogIn className="w-4 h-4" />
                )}
                {isLoggingIn ? 'Signing in...' : 'Admin'}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-8">
        {/* Search and Action Bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500" />
            <input 
              type="text"
              placeholder="Search by name, house no, or block..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-blue-900 border border-blue-800 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-white placeholder:text-blue-600"
            />
          </div>
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={handleDownloadTemplate}
                className="px-4 py-4 bg-blue-900 border border-blue-800 text-blue-400 hover:text-indigo-400 rounded-2xl font-bold hover:bg-blue-800 transition-all flex items-center justify-center gap-2 active:scale-95 shrink-0"
                title="Download Import Template"
              >
                <Download className="w-5 h-5" />
                Template
              </button>
              <label className="px-6 py-4 bg-blue-900 border border-blue-800 text-blue-300 rounded-2xl font-bold hover:bg-blue-800 transition-all flex items-center justify-center gap-2 active:scale-95 shrink-0 cursor-pointer">
                <FileUp className="w-5 h-5" />
                Import
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  className="hidden" 
                  onChange={handleImport}
                />
              </label>
              <button 
                onClick={() => {
                  setEditingResident(undefined);
                  setIsFormOpen(true);
                }}
                className="px-6 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 active:scale-95 shrink-0"
              >
                <Plus className="w-5 h-5" />
                Add Resident
              </button>
            </div>
          )}
        </div>

        {/* Sort Bar */}
        <div className="flex items-center gap-3 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          <div className="flex items-center gap-2 text-blue-500 shrink-0">
            <SortDesc className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Sort By:</span>
          </div>
          <button 
            onClick={() => setSortBy('name')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0",
              sortBy === 'name' 
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20" 
                : "bg-blue-900 text-blue-400 border border-blue-800 hover:bg-blue-800"
            )}
          >
            Name
          </button>
          <button 
            onClick={() => setSortBy('houseNumber')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0",
              sortBy === 'houseNumber' 
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20" 
                : "bg-blue-900 text-blue-400 border border-blue-800 hover:bg-blue-800"
            )}
          >
            House Number
          </button>
        </div>

        {/* Stats */}
        <div className="flex gap-4 mb-8 overflow-x-auto pb-2 scrollbar-hide">
          <div className="bg-blue-900 px-6 py-4 rounded-2xl border border-blue-800 min-w-[140px]">
            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">Total Residents</p>
            <p className="text-2xl font-black text-white">{residents.length}</p>
          </div>
          <div className="bg-blue-900 px-6 py-4 rounded-2xl border border-blue-800 min-w-[140px]">
            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">Results Found</p>
            <p className="text-2xl font-black text-indigo-400">{filteredResidents.length}</p>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-sm font-bold text-blue-500 uppercase tracking-widest">Loading directory...</p>
          </div>
        ) : filteredResidents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredResidents.map(resident => (
                <ResidentCard 
                  key={resident.id}
                  resident={resident}
                  isAdmin={isAdmin}
                  onEdit={(r) => {
                    setEditingResident(r);
                    setIsFormOpen(true);
                  }}
                  onDelete={handleDeleteResident}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-center py-20 bg-blue-900 rounded-[2.5rem] border border-dashed border-blue-800">
            <div className="w-16 h-16 bg-blue-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-blue-700" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">No residents found</h3>
            <p className="text-sm text-blue-500 font-medium">Try searching with a different term</p>
          </div>
        )}
      </main>

      {/* Form Modal */}
      <AnimatePresence>
        {isFormOpen && (
          <ResidentForm 
            resident={editingResident}
            onClose={() => setIsFormOpen(false)}
            onSave={handleSaveResident}
          />
        )}
      </AnimatePresence>

      {/* Footer Info */}
      <footer className="max-w-4xl mx-auto px-4 mt-12 text-center">
        <p className="text-[10px] font-bold text-blue-700 uppercase tracking-[0.2em]">
          Bethel Veng Champhai • Community Directory System
        </p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <DirectoryApp />
    </ErrorBoundary>
  );
}
