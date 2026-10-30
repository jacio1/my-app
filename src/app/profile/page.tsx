import { GoogleSignIn } from "@/components/google-sign-in";
import { auth } from "@/lib/auth";

export default async function ProfilePage() {
  const session = await auth()
  return(
    <div>
      <GoogleSignIn/>
      <p>Вы вошли: {session!.user?.email}</p>
    </div>
  )
}
