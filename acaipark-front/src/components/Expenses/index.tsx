"use client";

import ExpenseForm from "./expense-form";
import ExpenseHistory from "./expense-history";
import { useState } from "react";

export default function Expenses() {
  const [reloadToken, setReloadToken] = useState(0);
  return (
    <div className="space-y-6">
      <ExpenseForm onSaved={() => setReloadToken((value) => value + 1)} />
      <ExpenseHistory reloadToken={reloadToken} />
    </div>
  );
}
