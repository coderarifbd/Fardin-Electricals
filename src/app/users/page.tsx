'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/context/LanguageContext';
import { getUsersAction, createUserAction, resetPasswordAction, updateUserAction, exportDatabaseAction, restoreDatabaseAction, updateUserPermissionsAction } from '@/lib/actions';
import { 
  Users, 
  UserPlus, 
  Shield, 
  Key, 
  User, 
  Plus, 
  Edit2,
  Download,
  Upload,
  Database,
  Lock,
  Settings
} from 'lucide-react';

interface UserItem {
  id: number;
  username: string;
  name: string;
  role: 'OWNER' | 'STAFF';
  permissions?: {
    allowSales: boolean;
    allowPurchases: boolean;
    allowReports: boolean;
    allowDelete: boolean;
    allowStockEdit: boolean;
  } | null;
}

export default function UsersPage() {
  const { language, t, toast } = useLanguage();
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'OWNER' | 'STAFF'>('STAFF');
  const [creating, setCreating] = useState(false);

  // Password Reset State
  const [resettingUser, setResettingUser] = useState<UserItem | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);

  // Edit Profile Name State
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Edit Permissions State
  const [editingPermissionsUser, setEditingPermissionsUser] = useState<UserItem | null>(null);
  const [allowSales, setAllowSales] = useState(true);
  const [allowPurchases, setAllowPurchases] = useState(true);
  const [allowReports, setAllowReports] = useState(false);
  const [allowDelete, setAllowDelete] = useState(false);
  const [allowStockEdit, setAllowStockEdit] = useState(false);
  const [permissionsSubmitting, setPermissionsSubmitting] = useState(false);

  const handleOpenPermissionsModal = (user: UserItem) => {
    setEditingPermissionsUser(user);
    const p = user.permissions || {
      allowSales: true,
      allowPurchases: true,
      allowReports: false,
      allowDelete: false,
      allowStockEdit: false
    };
    setAllowSales(p.allowSales);
    setAllowPurchases(p.allowPurchases);
    setAllowReports(p.allowReports);
    setAllowDelete(p.allowDelete);
    setAllowStockEdit(p.allowStockEdit);
  };

  const handleUpdatePermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPermissionsUser) return;

    setPermissionsSubmitting(true);
    try {
      const res = await updateUserPermissionsAction(editingPermissionsUser.username, {
        allowSales,
        allowPurchases,
        allowReports,
        allowDelete,
        allowStockEdit
      });
      if (res.success) {
        toast(
          language === 'en'
            ? `Successfully updated permissions for @${editingPermissionsUser.username}!`
            : `সফলভাবে @${editingPermissionsUser.username} এর পারমিশন আপডেট করা হয়েছে!`,
          'success'
        );
        setEditingPermissionsUser(null);
        fetchUsers();
      }
    } catch (err: any) {
      toast(err.message || 'Failed to update permissions', 'error');
    } finally {
      setPermissionsSubmitting(false);
    }
  };

  // Backup & Restore State & Handlers
  const [backupActionLoading, setBackupActionLoading] = useState(false);

  const handleExportBackup = async () => {
    setBackupActionLoading(true);
    try {
      const data = await exportDatabaseAction();
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(data, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', `fardin_eshop_backup_${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast(
        language === 'en'
          ? 'Backup exported successfully!'
          : 'ডাটাবেজ ব্যাকআপ সফলভাবে ডাউনলোড হয়েছে!',
        'success'
      );
    } catch (err: any) {
      console.error(err);
      toast(err.message || 'Backup export failed', 'error');
    } finally {
      setBackupActionLoading(false);
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmMsg = language === 'en'
      ? 'WARNING: Restoring will overwrite all existing data. Are you sure you want to proceed?'
      : 'সতর্কতা: রিস্টোর করলে বর্তমানের সকল ডাটা মুছে নতুন ডাটা যুক্ত হবে। আপনি কি নিশ্চিতভাবে এগিয়ে যেতে চান?';
      
    if (!window.confirm(confirmMsg)) {
      e.target.value = '';
      return;
    }

    setBackupActionLoading(true);
    try {
      const fileReader = new FileReader();
      fileReader.onload = async (event) => {
        try {
          const text = event.target?.result;
          if (typeof text !== 'string') throw new Error('Failed to read backup file.');
          const parsed = JSON.parse(text);
          const res = await restoreDatabaseAction(parsed);
          if (res.success) {
            toast(
              language === 'en'
                ? 'Database restored successfully!'
                : 'ডাটাবেজ সফলভাবে রিস্টোর করা হয়েছে!',
              'success'
            );
            fetchUsers();
          }
        } catch (innerErr: any) {
          console.error(innerErr);
          toast(innerErr.message || 'Invalid backup file structure', 'error');
        } finally {
          setBackupActionLoading(false);
        }
      };
      fileReader.readAsText(file);
    } catch (err: any) {
      console.error(err);
      toast(err.message || 'File reading failed', 'error');
      setBackupActionLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const list = await getUsersAction();
      setUsersList(list as UserItem[]);
    } catch (err) {
      console.error(err);
      toast('Failed to load user accounts', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenResetModal = (user: UserItem) => {
    setResettingUser(user);
    setNewPassword('');
  };

  const handleOpenEditModal = (user: UserItem) => {
    setEditingUser(user);
    setEditName(user.name);
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editName.trim()) {
      toast(language === 'en' ? 'Name cannot be empty' : 'নাম খালি হতে পারে না', 'error');
      return;
    }

    setEditSubmitting(true);
    try {
      const res = await updateUserAction(editingUser.username, { name: editName });
      if (res.success) {
        toast(
          language === 'en'
            ? `Successfully updated name for "${editingUser.username}"!`
            : `সফলভাবে "${editingUser.username}" এর নাম পরিবর্তন করা হয়েছে!`,
          'success'
        );
        setEditingUser(null);
        setEditName('');
        fetchUsers();
      }
    } catch (err: any) {
      toast(err.message || 'Failed to update name', 'error');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser) return;
    if (!newPassword.trim()) {
      toast(language === 'en' ? 'Password cannot be empty' : 'পাসওয়ার্ড খালি হতে পারে না', 'error');
      return;
    }

    setResetSubmitting(true);
    try {
      const res = await resetPasswordAction(resettingUser.username, newPassword);
      if (res.success) {
        toast(
          language === 'en'
            ? `Successfully reset password for "${resettingUser.name}"!`
            : `সফলভাবে "${resettingUser.name}" এর পাসওয়ার্ড পরিবর্তন করা হয়েছে!`,
          'success'
        );
        setResettingUser(null);
        setNewPassword('');
      }
    } catch (err: any) {
      toast(err.message || 'Failed to reset password', 'error');
    } finally {
      setResetSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !username || !password) {
      toast(language === 'en' ? 'All fields are required' : 'সবগুলো ঘর পূরণ করা আবশ্যক', 'error');
      return;
    }

    if (username.length < 3) {
      toast(language === 'en' ? 'Username must be at least 3 characters' : 'ইউজারনেম কমপক্ষে ৩ অক্ষরের হতে হবে', 'error');
      return;
    }

    setCreating(true);
    try {
      const res = await createUserAction({
        username,
        passwordHash: password,
        role,
        name
      });

      if (res.success) {
        toast(
          language === 'en' 
            ? `Successfully created ${role} account for "${name}"!` 
            : `সফলভাবে "${name}" এর জন্য নতুন ${role === 'OWNER' ? 'মালিক' : 'স্টাফ'} অ্যাকাউন্ট তৈরি হয়েছে!`, 
          'success'
        );
        setName('');
        setUsername('');
        setPassword('');
        setRole('STAFF');
        fetchUsers();
      }
    } catch (err: any) {
      toast(err.message || 'Failed to create user account', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div>
        <h1 className="text-xl font-bold tracking-wide flex items-center gap-2">
          <Users className="h-5 w-5 text-amber-500" />
          {language === 'en' ? 'Account Management' : 'স্টাফ ও অ্যাকাউন্ট নিয়ন্ত্রণ খাতা'}
        </h1>
        <p className="text-xs text-neutral-500 mt-1">
          {language === 'en' ? 'Manage system owners and create new staff accounts.' : 'স্টোর ম্যানেজার এবং বিক্রয়কর্মীদের জন্য অ্যাকাউন্ট তৈরি ও নিয়ন্ত্রণ করুন।'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* User Accounts List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 backdrop-blur-sm p-6 shadow-xl space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300 border-b border-neutral-800 pb-3">
              {language === 'en' ? 'Registered Users' : 'নিবন্ধিত অ্যাকাউন্টসমূহ'}
            </h2>

            {loading ? (
              <div className="text-center py-12 text-xs text-neutral-500">{t('loading')}</div>
            ) : usersList.length === 0 ? (
              <div className="text-center py-12 text-xs text-neutral-500">No users found</div>
            ) : (
              <div className="divide-y divide-neutral-800/60">
                {usersList.map((user) => (
                  <div key={user.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 ${
                        user.role === 'OWNER' 
                          ? 'bg-purple-950/20 border-purple-900/40 text-purple-400' 
                          : 'bg-indigo-950/20 border-indigo-900/40 text-indigo-400'
                      }`}>
                        {user.role === 'OWNER' ? <Shield className="h-4.5 w-4.5" /> : <User className="h-4.5 w-4.5" />}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-neutral-200">{user.name}</div>
                        <div className="text-xs text-neutral-500 font-mono mt-0.5">@{user.username}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
                        user.role === 'OWNER'
                          ? 'bg-purple-950/50 border-purple-800/80 text-purple-400'
                          : 'bg-indigo-950/50 border-indigo-800/80 text-indigo-400'
                      }`}>
                        {user.role === 'OWNER' ? (language === 'en' ? 'Owner' : 'মালিক') : (language === 'en' ? 'Staff' : 'স্টাফ')}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(user)}
                        title={language === 'en' ? 'Edit Profile' : 'তথ্য সংশোধন'}
                        className="p-1.5 rounded-lg border border-neutral-800 hover:border-amber-500/50 bg-neutral-950 hover:bg-amber-500/10 text-neutral-400 hover:text-amber-500 transition-all cursor-pointer"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenResetModal(user)}
                        title={language === 'en' ? 'Reset Password' : 'পাসওয়ার্ড রিসেট'}
                        className="p-1.5 rounded-lg border border-neutral-800 hover:border-amber-500/50 bg-neutral-950 hover:bg-amber-500/10 text-neutral-400 hover:text-amber-500 transition-all cursor-pointer"
                      >
                        <Key className="h-3.5 w-3.5" />
                      </button>

                      {user.role === 'STAFF' && (
                        <button
                          type="button"
                          onClick={() => handleOpenPermissionsModal(user)}
                          title={language === 'en' ? 'Manage Permissions' : 'পারমিশন নিয়ন্ত্রণ'}
                          className="p-1.5 rounded-lg border border-neutral-800 hover:border-purple-500/50 bg-neutral-950 hover:bg-purple-500/10 text-neutral-400 hover:text-purple-500 transition-all cursor-pointer"
                        >
                          <Lock className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar Column */}
        <div className="space-y-6">
          {/* Create User Form */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 backdrop-blur-sm p-6 shadow-xl relative overflow-hidden space-y-4">
            <div className="absolute right-0 top-0 h-24 w-24 bg-gradient-to-br from-amber-500/10 to-transparent blur-xl pointer-events-none" />
            
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300 border-b border-neutral-800 pb-3 flex items-center gap-1.5">
              <UserPlus className="h-4.5 w-4.5 text-amber-500" />
              {language === 'en' ? 'Create Account' : 'নতুন অ্যাকাউন্ট তৈরি'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 pl-1 block">
                  {language === 'en' ? 'Full Name' : 'পূর্ণ নাম'}
                </label>
                <input
                  type="text"
                  placeholder={language === 'en' ? 'e.g. Kabir Hossain' : 'যেমন: কবির হোসেন'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200 outline-none focus:border-amber-500 transition-colors placeholder-neutral-600"
                />
              </div>

              {/* Username */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 pl-1 block">
                  {language === 'en' ? 'Username' : 'ইউজারনেম (লগইন নাম)'}
                </label>
                <input
                  type="text"
                  placeholder={language === 'en' ? 'e.g. kabir_fardin' : 'যেমন: kabir_fardin'}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200 outline-none focus:border-amber-500 transition-colors placeholder-neutral-600 font-mono"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 pl-1 block">
                  {language === 'en' ? 'Password' : 'পাসওয়ার্ড'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 pr-10 text-sm text-neutral-200 outline-none focus:border-amber-500 transition-colors placeholder-neutral-600 font-mono"
                  />
                  <Key className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-600" />
                </div>
              </div>

              {/* Role selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 pl-1 block">
                  {language === 'en' ? 'Account Role' : 'অ্যাকাউন্টের দায়িত্ব (পদবী)'}
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'OWNER' | 'STAFF')}
                  className="w-full rounded-xl border border-neutral-850 bg-neutral-950 p-3 text-sm text-neutral-350 outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="STAFF">{language === 'en' ? 'Staff Account (স্টাফ)' : 'স্টাফ অ্যাকাউন্ট'}</option>
                  <option value="OWNER">{language === 'en' ? 'Owner Account (মালিক)' : 'মালিক অ্যাকাউন্ট'}</option>
                </select>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={creating}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 p-3.5 text-xs font-bold text-black transition-colors disabled:opacity-50 mt-4 select-none"
              >
                <Plus className="h-4.5 w-4.5" />
                {creating ? (language === 'en' ? 'Creating...' : 'তৈরি হচ্ছে...') : (language === 'en' ? 'Create User' : 'অ্যাকাউন্ট তৈরি করুন')}
              </button>
            </form>
          </div>

          {/* Backup & Restore Panel */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 backdrop-blur-sm p-6 shadow-xl relative overflow-hidden space-y-4 animate-slide-in">
            <div className="absolute right-0 top-0 h-24 w-24 bg-gradient-to-br from-purple-500/10 to-transparent blur-xl pointer-events-none" />
            
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300 border-b border-neutral-800 pb-3 flex items-center gap-1.5">
              <Database className="h-4.5 w-4.5 text-purple-400" />
              {language === 'en' ? 'Database Backup' : 'ডাটাবেজ ব্যাকআপ ও রিস্টোর'}
            </h2>

            <div className="space-y-4 text-xs">
              <p className="text-neutral-400 leading-relaxed text-[11px]">
                {language === 'en' 
                  ? 'Export a snapshot of all system data to your local machine, or restore the database from an existing backup file.' 
                  : 'আপনার দোকানের সমস্ত হিসাবের একটি ব্যাকআপ ফাইল ডাউনলোড করুন, অথবা পূর্বের ব্যাকআপ ফাইল থেকে ডাটা পুনরায় রিস্টোর করুন।'}
              </p>

              <div className="grid grid-cols-2 gap-3">
                {/* Export Button */}
                <button
                  type="button"
                  onClick={handleExportBackup}
                  disabled={backupActionLoading}
                  className="flex items-center justify-center gap-2 rounded-xl bg-purple-950/40 border border-purple-900/60 hover:bg-purple-900/30 p-3 text-xs font-bold text-purple-400 transition-colors disabled:opacity-50 cursor-pointer select-none"
                >
                  <Download className="h-4 w-4" />
                  {language === 'en' ? 'Export' : 'ডাউনলোড'}
                </button>

                {/* Import Button */}
                <label
                  className={`flex items-center justify-center gap-2 rounded-xl bg-neutral-950 border border-neutral-850 hover:border-purple-500/40 hover:bg-purple-950/10 p-3 text-xs font-bold text-neutral-400 hover:text-purple-400 transition-all cursor-pointer select-none ${backupActionLoading ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <Upload className="h-4 w-4" />
                  <span>{language === 'en' ? 'Import' : 'রিস্টোর'}</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportBackup}
                    className="hidden"
                    disabled={backupActionLoading}
                  />
                </label>
              </div>
              
              {backupActionLoading && (
                <div className="text-center text-[10px] text-purple-400 animate-pulse font-semibold mt-1">
                  {language === 'en' ? 'Processing database operation...' : 'ডাটাবেজ অপারেশন প্রসেস হচ্ছে...'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Password Reset Modal */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl relative overflow-hidden space-y-4">
            <div className="absolute right-0 top-0 h-24 w-24 bg-gradient-to-br from-amber-500/10 to-transparent blur-xl pointer-events-none" />
            
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-200 flex items-center gap-1.5">
                <Key className="h-4.5 w-4.5 text-amber-500" />
                {language === 'en' ? 'Reset Password' : 'পাসওয়ার্ড পরিবর্তন করুন'}
              </h2>
              <p className="text-[11px] text-neutral-400 mt-1">
                {language === 'en' 
                  ? `Change password for ${resettingUser.name} (@${resettingUser.username})` 
                  : `ব্যবহারকারী: ${resettingUser.name} (@${resettingUser.username}) এর পাসওয়ার্ড পরিবর্তন`
                }
              </p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 pl-1 block">
                  {language === 'en' ? 'New Password' : 'নতুন পাসওয়ার্ড'}
                </label>
                <input
                  type="text"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-200 outline-none focus:border-amber-500 transition-colors font-mono"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setResettingUser(null)}
                  className="px-4 py-2.5 rounded-xl border border-neutral-800 hover:bg-neutral-900 text-xs font-semibold text-neutral-400 transition-colors cursor-pointer select-none"
                >
                  {language === 'en' ? 'Cancel' : 'বাতিল'}
                </button>
                <button
                  type="submit"
                  disabled={resetSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-bold text-black transition-colors disabled:opacity-50 cursor-pointer select-none"
                >
                  {resetSubmitting 
                    ? (language === 'en' ? 'Saving...' : 'রিসেট হচ্ছে...') 
                    : (language === 'en' ? 'Reset Password' : 'রিসেট করুন')
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Profile Name Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl relative overflow-hidden space-y-4">
            <div className="absolute right-0 top-0 h-24 w-24 bg-gradient-to-br from-amber-500/10 to-transparent blur-xl pointer-events-none" />
            
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-200 flex items-center gap-1.5">
                <Edit2 className="h-4.5 w-4.5 text-amber-500" />
                {language === 'en' ? 'Edit User Profile' : 'ব্যবহারকারীর তথ্য সংশোধন'}
              </h2>
              <p className="text-[11px] text-neutral-400 mt-1">
                {language === 'en' 
                  ? `Update full name for @${editingUser.username}` 
                  : `@${editingUser.username} এর পূর্ণ নাম পরিবর্তন করুন`
                }
              </p>
            </div>

            <form onSubmit={handleUpdateName} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 pl-1 block">
                  {language === 'en' ? 'Full Name' : 'পূর্ণ নাম'}
                </label>
                <input
                  type="text"
                  placeholder="e.g. Al-Haj Rafiqul Islam"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-200 outline-none focus:border-amber-500 transition-colors"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2.5 rounded-xl border border-neutral-800 hover:bg-neutral-900 text-xs font-semibold text-neutral-400 transition-colors cursor-pointer select-none"
                >
                  {language === 'en' ? 'Cancel' : 'বাতিল'}
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-bold text-black transition-colors disabled:opacity-50 cursor-pointer select-none"
                >
                  {editSubmitting 
                    ? (language === 'en' ? 'Saving...' : 'সংরক্ষণ হচ্ছে...') 
                    : (language === 'en' ? 'Save Changes' : 'পরিবর্তন সংরক্ষণ করুন')
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Permissions Modal */}
      {editingPermissionsUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl relative overflow-hidden space-y-4">
            <div className="absolute right-0 top-0 h-24 w-24 bg-gradient-to-br from-purple-500/10 to-transparent blur-xl pointer-events-none" />
            
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-200 flex items-center gap-1.5">
                <Lock className="h-4.5 w-4.5 text-purple-400" />
                {language === 'en' ? 'Manage Permissions' : 'পারমিশন নিয়ন্ত্রণ'}
              </h2>
              <p className="text-[11px] text-neutral-400 mt-1">
                {language === 'en' 
                  ? `Set system access rights for @${editingPermissionsUser.username} (${editingPermissionsUser.name})` 
                  : `ব্যবহারকারী: @${editingPermissionsUser.username} (${editingPermissionsUser.name}) এর অ্যাক্সেস পারমিশন সেট করুন`
                }
              </p>
            </div>

            <form onSubmit={handleUpdatePermissions} className="space-y-4 text-xs">
              <div className="space-y-3 border-y border-neutral-850 py-4 max-h-[350px] overflow-y-auto pr-1">
                {/* Sales Checkbox */}
                <label className="flex items-center justify-between p-3 rounded-xl border border-neutral-850 bg-neutral-900/10 hover:bg-neutral-900/30 transition-all cursor-pointer">
                  <div className="pr-4">
                    <span className="font-bold text-neutral-200 block text-xs">
                      {language === 'en' ? 'Allow Sales' : 'বিক্রি খাতা এন্ট্রি'}
                    </span>
                    <span className="text-[10px] text-neutral-500 mt-0.5 block leading-normal">
                      {language === 'en' ? 'Allow staff to create and view sales invoices.' : 'স্টাফকে বিক্রি এন্ট্রি করার অনুমতি দিন।'}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowSales}
                    onChange={(e) => setAllowSales(e.target.checked)}
                    className="h-4.5 w-4.5 rounded border-neutral-800 text-purple-600 focus:ring-purple-500 cursor-pointer accent-purple-500 shrink-0"
                  />
                </label>

                {/* Purchases Checkbox */}
                <label className="flex items-center justify-between p-3 rounded-xl border border-neutral-850 bg-neutral-900/10 hover:bg-neutral-900/30 transition-all cursor-pointer">
                  <div className="pr-4">
                    <span className="font-bold text-neutral-200 block text-xs">
                      {language === 'en' ? 'Allow Purchases' : 'ক্রয় খাতা এন্ট্রি'}
                    </span>
                    <span className="text-[10px] text-neutral-500 mt-0.5 block leading-normal">
                      {language === 'en' ? 'Allow staff to log supplier purchase invoices.' : 'স্টাফকে মহাজন থেকে পণ্য ক্রয় এন্ট্রি করার অনুমতি দিন।'}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowPurchases}
                    onChange={(e) => setAllowPurchases(e.target.checked)}
                    className="h-4.5 w-4.5 rounded border-neutral-800 text-purple-600 focus:ring-purple-500 cursor-pointer accent-purple-500 shrink-0"
                  />
                </label>

                {/* Reports Checkbox */}
                <label className="flex items-center justify-between p-3 rounded-xl border border-neutral-850 bg-neutral-900/10 hover:bg-neutral-900/30 transition-all cursor-pointer">
                  <div className="pr-4">
                    <span className="font-bold text-neutral-200 block text-xs">
                      {language === 'en' ? 'Allow Accounting Reports' : 'আর্থিক রিপোর্ট ও ড্যাশবোর্ড ভিউ'}
                    </span>
                    <span className="text-[10px] text-neutral-500 mt-0.5 block leading-normal">
                      {language === 'en' ? 'Allow staff to view ledger balance, expenses & reports.' : 'স্টাফকে হিসাবের খাতা, খরচ এবং লাভ-ক্ষতির রিপোর্ট দেখার অনুমতি দিন।'}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowReports}
                    onChange={(e) => setAllowReports(e.target.checked)}
                    className="h-4.5 w-4.5 rounded border-neutral-800 text-purple-600 focus:ring-purple-500 cursor-pointer accent-purple-500 shrink-0"
                  />
                </label>

                {/* Delete Checkbox */}
                <label className="flex items-center justify-between p-3 rounded-xl border border-neutral-850 bg-neutral-900/10 hover:bg-neutral-900/30 transition-all cursor-pointer">
                  <div className="pr-4">
                    <span className="font-bold text-neutral-200 block text-xs">
                      {language === 'en' ? 'Allow Void/Delete' : 'ইনভয়েস ডিলিট / বাতিলকরণ'}
                    </span>
                    <span className="text-[10px] text-neutral-500 mt-0.5 block leading-normal">
                      {language === 'en' ? 'Allow staff to delete or void active sales/purchase invoices.' : 'স্টাফকে ভুল এন্ট্রি হওয়া বিল ডিলিট করার অনুমতি দিন।'}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowDelete}
                    onChange={(e) => setAllowDelete(e.target.checked)}
                    className="h-4.5 w-4.5 rounded border-neutral-800 text-purple-600 focus:ring-purple-500 cursor-pointer accent-purple-500 shrink-0"
                  />
                </label>

                {/* Stock Edit Checkbox */}
                <label className="flex items-center justify-between p-3 rounded-xl border border-neutral-850 bg-neutral-900/10 hover:bg-neutral-900/30 transition-all cursor-pointer">
                  <div className="pr-4">
                    <span className="font-bold text-neutral-200 block text-xs">
                      {language === 'en' ? 'Allow Product & Stock Edit' : 'পণ্য ও স্টক এডিট'}
                    </span>
                    <span className="text-[10px] text-neutral-500 mt-0.5 block leading-normal">
                      {language === 'en' ? 'Allow staff to create new products, edit attributes and adjust stock.' : 'স্টাফকে নতুন পণ্য যোগ ও পণ্যের স্টক পরিবর্তন করার অনুমতি দিন।'}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowStockEdit}
                    onChange={(e) => setAllowStockEdit(e.target.checked)}
                    className="h-4.5 w-4.5 rounded border-neutral-800 text-purple-600 focus:ring-purple-500 cursor-pointer accent-purple-500 shrink-0"
                  />
                </label>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPermissionsUser(null)}
                  className="px-4 py-2.5 rounded-xl border border-neutral-800 hover:bg-neutral-900 text-xs font-semibold text-neutral-400 transition-colors cursor-pointer select-none"
                >
                  {language === 'en' ? 'Cancel' : 'বাতিল'}
                </button>
                <button
                  type="submit"
                  disabled={permissionsSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition-colors disabled:opacity-50 cursor-pointer select-none"
                >
                  {permissionsSubmitting 
                    ? (language === 'en' ? 'Saving...' : 'সংরক্ষণ হচ্ছে...') 
                    : (language === 'en' ? 'Save Permissions' : 'পারমিশন সেভ করুন')
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
