import { Suspense } from "react";
import SignupWithPassword from "../SignupWithPassword";

export default function Signup() {
  return (
    <>
      <div>
        <Suspense fallback={null}>
          <SignupWithPassword />
        </Suspense>
      </div>
    </>
  );
}
