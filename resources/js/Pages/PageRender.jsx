import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../Services/AutServiceProvider';
import Login from './Login/Index';

export default function Root() {
	return (
		<AuthProvider>
			<Routes>
				<Route path="/" element={<Navigate to="/login" replace />} />
				<Route path="/login" element={<Login />} />
			</Routes>
		</AuthProvider>
	);
}
