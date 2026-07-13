import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../Services/AutServiceProvider';
import Login from './Login/Index';
import Register from './Register/Index';
import Feed from './Feed/Index';
import VerifyAuth from './VerifyAuth';

export default function Root() {
	return (
		<AuthProvider>
			<Routes>
				<Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
				<Route
					path="/"
					element={
						<VerifyAuth>
							<Feed />
						</VerifyAuth>
					}
				/>
			</Routes>
		</AuthProvider>
	);
}
