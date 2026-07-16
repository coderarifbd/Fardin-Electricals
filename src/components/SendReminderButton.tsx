'use client';

import React, { useState } from 'react';
import { sendDueReminderSMSAction } from '@/lib/actions';
import { Send, Check, Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/context/LanguageContext';

interface SendReminderButtonProps {
  invoiceId: number;
}

export default function SendReminderButton({ invoiceId }: SendReminderButtonProps) {
  const { language, toast } = useLanguage();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSendReminder = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (sending || sent) return;

    setSending(true);
    try {
      const res = await sendDueReminderSMSAction(invoiceId);
      if (res.success) {
        setSent(true);
        toast(
          language === 'en'
            ? 'Due reminder SMS queued/sent successfully!'
            : 'বাকির তাগাদা এসএমএস সফলভাবে পাঠানো হয়েছে!',
          'success'
        );
        setTimeout(() => setSent(false), 5000); // reset after 5s
      } else {
        toast((res as any).error || (res as any).statusDetail || 'Failed to send SMS', 'error');
      }
    } catch (err: any) {
      console.error(err);
      toast(err.message || 'Error sending SMS', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <button
      onClick={handleSendReminder}
      disabled={sending}
      title={language === 'en' ? 'Send SMS Reminder' : 'এসএমএস তাগাদা পাঠান'}
      className={`p-1.5 rounded-lg border flex items-center justify-center transition-all shrink-0 cursor-pointer ${
        sent
          ? 'bg-emerald-950/40 border-emerald-800 text-emerald-400'
          : 'bg-neutral-900 border-neutral-800 hover:border-amber-500/50 hover:bg-amber-500/10 text-neutral-400 hover:text-amber-500'
      }`}
    >
      {sending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : sent ? (
        <Check className="h-3 w-3" />
      ) : (
        <Send className="h-3 w-3" />
      )}
    </button>
  );
}
