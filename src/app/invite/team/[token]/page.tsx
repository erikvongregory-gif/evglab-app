"use client";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
export default function AcceptTeamInvitation() {
  const { token } = useParams<{token:string}>();
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function accept() {
    setBusy(true);setError("");
    try {
      const response=await fetch("/api/dashboard/team/accept",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error);
      router.replace("/dashboard");router.refresh();
    } catch(reason) {setError(reason instanceof Error?reason.message:"Einladung konnte nicht angenommen werden.");}
    finally {setBusy(false);}
  }
  const next=encodeURIComponent(`/invite/team/${token}`);
  return <main className="mx-auto max-w-lg space-y-6 p-8">
    <h1 className="text-2xl font-semibold">Deinem BrewAI-Team beitreten</h1>
    <p>Melde dich mit der E-Mail-Adresse an, an die die Einladung geschickt wurde. Anschließend kannst du dem Team beitreten.</p>
    <p><a className="underline" href={`/anmelden?next=${next}`}>Anmelden</a> · <a className="underline" href={`/registrieren?next=${next}`}>Konto erstellen</a> · <a className="underline" href={`/dashboard/2fa-email?next=${next}`}>Zwei-Faktor-Prüfung</a></p>
    <button className="rounded bg-orange-600 px-5 py-3 text-white disabled:opacity-50" disabled={busy} onClick={accept}>{busy?"Wird geprüft …":"Einladung annehmen"}</button>
    {error&&<p role="alert">{error}</p>}
  </main>;
}
