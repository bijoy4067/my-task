import { Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from '../Services/AutServiceProvider';

export default function VerifyAuth({ children }) {
    const { user, loading } = AuthProvider();
    const location = useLocation();

    if (loading) {
        return null;
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
}
