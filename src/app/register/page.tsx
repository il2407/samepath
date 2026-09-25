import { redirect } from "next/navigation";

// The 3-step explanation used to live here, before account creation — it
// now shows right after the email OTP instead (/app/onboarding/welcome), so
// this entry point goes straight to the sign-up form.
export default function RegisterPage() {
  redirect("/register/create");
}
