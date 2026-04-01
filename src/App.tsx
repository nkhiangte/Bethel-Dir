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
        <div className="min-h-screen flex items-center justify-center bg-black p-4">
          <div className="max-w-md w-full bg-zinc-900 rounded-2xl shadow-xl p-8 text-center border border-zinc-800">
            <div className="w-16 h-16 bg-red-950/40 rounded-full flex items-center justify-center mx-auto mb-6">
              <X className="w-8 h-8 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-zinc-400 mb-6">
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
      className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5 hover:border-indigo-500/50 transition-all group relative"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">{resident.name}</h3>
          <p className="text-sm text-zinc-400 font-medium">House No: {resident.houseNumber}</p>
        </div>
        <div className="bg-indigo-500/10 text-indigo-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
          Block {resident.block}
        </div>
      </div>

      <div className="flex items-center gap-3 text-zinc-300 mb-2">
        <Phone className="w-4 h-4 text-indigo-400" />
        <span className="text-sm font-medium tracking-wide">{resident.phoneNumber}</span>
      </div>

      {resident.landmark && (
        <div className="flex items-center gap-3 text-zinc-500 mb-6">
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
            className="p-2 bg-zinc-800/80 backdrop-blur-sm border border-zinc-700 rounded-lg text-zinc-300 hover:text-indigo-400 hover:border-indigo-500/50 transition-all"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => resident.id && onDelete(resident.id)}
            className="p-2 bg-zinc-800/80 backdrop-blur-sm border border-zinc-700 rounded-lg text-zinc-300 hover:text-red-400 hover:border-red-500/50 transition-all"
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
        className="bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-zinc-800"
      >
        <div className="px-8 pt-8 pb-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">
              {resident ? 'Edit Resident' : 'Add Resident'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
              <X className="w-6 h-6 text-zinc-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Full Name</label>
              <input 
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-zinc-800 text-white transition-all outline-none"
                placeholder="e.g. Lalramchhana"
              />
            </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">House No</label>
                  <input 
                    required
                    value={formData.houseNumber}
                    onChange={e => setFormData({ ...formData, houseNumber: e.target.value })}
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-zinc-800 text-white transition-all outline-none"
                    placeholder="e.g. B-42"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Block (Optional)</label>
                  <input 
                    value={formData.block}
                    onChange={e => setFormData({ ...formData, block: e.target.value })}
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-zinc-800 text-white transition-all outline-none"
                    placeholder="e.g. 1"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Phone Number (Optional)</label>
                <input 
                  value={formData.phoneNumber}
                  onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-zinc-800 text-white transition-all outline-none"
                  placeholder="e.g. 9876543210"
                />
              </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Landmark (Optional)</label>
              <input 
                value={formData.landmark}
                onChange={e => setFormData({ ...formData, landmark: e.target.value })}
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-zinc-800 text-white transition-all outline-none"
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
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);

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

        data.forEach((row, index) => {
          const name = String(row.name || row.Name || '').trim();
          const houseNumber = String(row.houseNumber || row.HouseNumber || row['House No'] || '').trim();
          const block = String(row.block || row.Block || '').trim();
          const phoneNumber = String(row.phoneNumber || row.PhoneNumber || row['Phone Number'] || row.Phone || '').trim();
          const landmark = String(row.landmark || row.Landmark || '').trim();

          if (index < 3) {
            console.log(`Importing row ${index}:`, { name, houseNumber, block, phoneNumber, landmark });
          }

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
      if (selectedResident?.id === id) {
        setSelectedResident(null);
      }
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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (filteredResidents.length > 0) {
      setSelectedResident(filteredResidents[0]);
    }
  };

  const isAdmin = userProfile?.role === 'admin' || user?.email === 'nkhiangte@gmail.com';

  if (firestoreConnectionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-4">
        <div className="max-w-md w-full bg-zinc-900 rounded-2xl shadow-xl p-8 text-center border border-zinc-800">
          <div className="w-16 h-16 bg-red-950/40 rounded-full flex items-center justify-center mx-auto mb-6">
            <X className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Connection Error</h1>
          <p className="text-zinc-400 mb-6">
            {firestoreConnectionError.includes('the client is offline') 
              ? "Please check your Firebase configuration. The application is unable to reach the Firestore database."
              : `Firestore connection test failed: ${firestoreConnectionError}`}
          </p>
          <div className="text-left bg-black p-4 rounded-xl mb-6 overflow-auto max-h-40 border border-zinc-800">
            <p className="text-xs font-mono text-zinc-500 break-all">
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
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-40 backdrop-blur-md bg-black/80">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
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
            {isAdmin && (
              <div className="hidden md:flex gap-2">
                <button 
                  onClick={handleDownloadTemplate}
                  className="p-2.5 bg-zinc-800 text-zinc-400 hover:text-indigo-400 rounded-xl transition-all"
                  title="Download Import Template"
                >
                  <Download className="w-5 h-5" />
                </button>
                <label className="p-2.5 bg-zinc-800 text-zinc-400 hover:text-indigo-400 rounded-xl transition-all cursor-pointer">
                  <FileUp className="w-5 h-5" />
                  <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleImport} />
                </label>
                <button 
                  onClick={() => {
                    setEditingResident(undefined);
                    setIsFormOpen(true);
                  }}
                  className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            )}
            {user ? (
              <>
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-bold text-white">{user.displayName}</p>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{userProfile?.role}</p>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2.5 bg-zinc-800 text-zinc-400 hover:text-red-400 hover:bg-red-950/40 rounded-xl transition-all active:scale-95"
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

      <div className="flex-1 flex overflow-hidden">
        {/* Main Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col items-center">
          <div className="w-full max-w-2xl">
            <form onSubmit={handleSearchSubmit} className="relative mb-12">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-500" />
              <input 
                type="text"
                placeholder="Search by name, house no..."
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  if (!e.target.value) setSelectedResident(null);
                }}
                onFocus={() => {}}
                className="w-full pl-16 pr-32 py-6 bg-zinc-900 border border-zinc-800 rounded-[2rem] focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-xl text-white placeholder:text-zinc-600 shadow-2xl"
              />
              <button 
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 px-6 py-3 bg-indigo-600 text-white rounded-[1.5rem] font-bold hover:bg-indigo-700 transition-all active:scale-95"
              >
                Enter
              </button>

              {/* Search Suggestions */}
              <AnimatePresence>
                {search.length >= 2 && filteredResidents.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-60 overflow-y-auto"
                  >
                    {filteredResidents.slice(0, 8).map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setSelectedResident(r);
                          setSearch(r.name);
                        }}
                        className="w-full text-left px-6 py-4 hover:bg-indigo-600/20 transition-colors border-b border-zinc-800/50 last:border-0 flex justify-between items-center"
                      >
                        <div>
                          <p className="font-bold text-white">{r.name}</p>
                          <p className="text-xs text-zinc-500">House No: {r.houseNumber}</p>
                        </div>
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Select</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </form>

            <AnimatePresence mode="wait">
              {selectedResident ? (
                <motion.div
                  key={selectedResident.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-zinc-900 rounded-[2.5rem] border border-zinc-800 p-8 md:p-12 shadow-2xl relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
                  
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-8">
                      <div>
                        <h2 className="text-4xl font-black text-white mb-2 tracking-tight">{selectedResident.name}</h2>
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-xs font-bold uppercase tracking-widest">
                            Block {selectedResident.block || 'N/A'}
                          </span>
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              setEditingResident(selectedResident);
                              setIsFormOpen(true);
                            }}
                            className="p-3 bg-zinc-800 text-zinc-300 hover:text-indigo-400 rounded-xl transition-all"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => selectedResident.id && handleDeleteResident(selectedResident.id)}
                            className="p-3 bg-zinc-800 text-zinc-300 hover:text-red-400 rounded-xl transition-all"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                      <div className="space-y-6">
                        <div>
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">House Number</p>
                          <p className="text-2xl font-bold text-white">{selectedResident.houseNumber}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Phone Number</p>
                          <p className="text-2xl font-bold text-white">{selectedResident.phoneNumber || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="space-y-6">
                        <div>
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Landmark</p>
                          <p className="text-lg text-zinc-200 italic">
                            {selectedResident.landmark ? `Near ${selectedResident.landmark}` : 'No landmark provided'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {selectedResident.phoneNumber && (
                      <div className="grid grid-cols-2 gap-4">
                        <button 
                          onClick={() => window.location.href = `tel:${selectedResident.phoneNumber}`}
                          className="flex items-center justify-center gap-3 py-5 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all active:scale-95 shadow-xl shadow-indigo-500/20"
                        >
                          <PhoneCall className="w-6 h-6" />
                          Call Now
                        </button>
                        <button 
                          onClick={() => {
                            const cleanPhone = selectedResident.phoneNumber.replace(/\D/g, '');
                            window.open(`https://wa.me/${cleanPhone}`, '_blank');
                          }}
                          className="flex items-center justify-center gap-3 py-5 bg-emerald-600 text-white rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-all active:scale-95 shadow-xl shadow-emerald-500/20"
                        >
                          <MessageCircle className="w-6 h-6" />
                          WhatsApp
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : (
                <div className="text-center py-32">
                  <div className="w-24 h-24 bg-zinc-900 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-zinc-800">
                    <Search className="w-10 h-10 text-zinc-700" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Search for a resident</h3>
                  <p className="text-zinc-500">Enter a name or house number to see details</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </main>

        {/* Right Sidebar - Names List */}
        <aside className="w-80 bg-zinc-900/50 border-l border-zinc-800 flex flex-col hidden lg:flex">
          <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Resident List</h3>
            <span className="text-[10px] font-bold bg-zinc-800 px-2 py-1 rounded text-zinc-400">
              {filteredResidents.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
            {filteredResidents.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedResident(r)}
                className={cn(
                  "w-full text-left px-6 py-4 transition-all border-b border-zinc-800/50 hover:bg-zinc-800/50",
                  selectedResident?.id === r.id ? "bg-indigo-600/20 border-l-4 border-l-indigo-500 text-white" : "text-zinc-300"
                )}
              >
                <p className="font-bold text-sm truncate">{r.name}</p>
                <p className="text-[10px] opacity-60 truncate">{r.houseNumber}</p>
              </button>
            ))}
          </div>
        </aside>
      </div>

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
