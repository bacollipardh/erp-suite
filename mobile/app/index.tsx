import { Redirect } from 'expo-router';
import { LoadingState, Screen } from '../src/components/ui';
import { resolveHomePath } from '../src/lib/permissions';
import { useAuth } from '../src/providers/auth-provider';

export default function IndexScreen() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Screen>
        <LoadingState label="Duke përgatitur ERP Mobile..." />
      </Screen>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return <Redirect href={resolveHomePath(user) as any} />;
}
