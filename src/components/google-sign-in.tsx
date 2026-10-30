import { signIn } from "@/lib/auth";
import { Button } from "./ui/button";

export const GoogleSignIn = () => {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google");
      }}
    >
      <Button type="submit">Войти с помощью Google</Button>
    </form>
  );
};
