import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../Services/AutServiceProvider';

export default function VerifyAuth({ children }) {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return null;
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
}
