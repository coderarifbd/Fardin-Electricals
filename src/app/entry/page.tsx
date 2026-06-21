import React, { Suspense } from 'react';
import EntryForm from '@/components/EntryForm';

export default function EntryPage() {
  return (
    <Suspense 
      fallback={
        <div className="w-full flex items-center justify-center min-h-[50vh] text-xs text-neutral-500 font-mono">
          Loading back-entry sheet...
        </div>
      }
    >
      <EntryForm />
    </Suspense>
  );
}
