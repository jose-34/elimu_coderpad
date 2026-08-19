import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function NavBar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="text-lg font-semibold text-brand-700">
          KEMSAP CodeLive
        </Link>
        {user && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-600">
              {user.firstName} {user.lastName}
            </span>
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
            >
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
