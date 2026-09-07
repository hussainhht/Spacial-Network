import AuthLayout from "@/features/auth/components/AuthLayout";
import AuthHero from "@/features/auth/components/AuthHero";
import RegisterForm from "@/features/auth/components/RegisterForm";

export default function RegisterPage() {
  return (
    <AuthLayout
      cardSize="lg"
      hero={
        <AuthHero
          titlePrefix="A bigger"
          titleAccent="universe together"
          subtitle="Connect with people, share your world, and join communities."
          benefits={[
            { icon: "user", label: "Meet new people" },
            { icon: "groups", label: "Join communities" },
            { icon: "posts", label: "Share your ideas" },
            { icon: "planet", label: "Be yourself" },
          ]}
        />
      }
    >
      <RegisterForm />
    </AuthLayout>
  );
}
