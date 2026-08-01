import React from "react";
import Header from "./Header";
import {
  ACCESS_PENDING_DESCRIPTION,
  ACCESS_PENDING_SUBTITLE,
  ACCESS_PENDING_SUPPORT,
  ACCESS_PENDING_TITLE,
} from "@/lib/accessMessages";

const AcessoPendente = ({ user }) => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] transition-colors duration-200">
      <Header
        user={user}
        title={ACCESS_PENDING_TITLE}
        subtitle={ACCESS_PENDING_SUBTITLE}
        showBack={false}
      />

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111111] p-10 shadow-sm">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
              {ACCESS_PENDING_TITLE}
            </h1>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
              {ACCESS_PENDING_DESCRIPTION}
            </p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {ACCESS_PENDING_SUPPORT}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AcessoPendente;
