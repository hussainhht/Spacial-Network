import AuthLayout from "@/features/auth/components/AuthLayout";
import AuthHero from "@/features/auth/components/AuthHero";
import LoginForm from "@/features/auth/components/LoginForm";

export default function LoginPage() {
  return (
    <AuthLayout
      cardSize="sm"
      hero={
        <AuthHero
          titlePrefix="Welcome"
          titleAccent="back"
          subtitle="Good to see you again. Continue your journey in the universe."
        />
      }
    >
      <LoginForm />
    </AuthLayout>
  );
}
