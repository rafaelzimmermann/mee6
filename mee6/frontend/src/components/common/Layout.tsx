import { Link } from "react-router-dom";

export interface LayoutProps {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function Layout({ title, children, actions }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link to="/" className="text-xl font-bold text-blue-500">
                  mee6
                </Link>
              </div>
              <div className="ml-6 flex space-x-8">
                <Link
                  to="/pipelines"
                  className="border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 inline-flex items-center px-1 pt-1 text-sm font-medium"
                >
                  Pipelines
                </Link>
                <Link
                  to="/triggers"
                  className="border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 inline-flex items-center px-1 pt-1 text-sm font-medium"
                >
                  Triggers
                </Link>
                <Link
                  to="/history"
                  className="border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 inline-flex items-center px-1 pt-1 text-sm font-medium"
                >
                  History
                </Link>
                <Link
                  to="/integrations"
                  className="border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 inline-flex items-center px-1 pt-1 text-sm font-medium"
                >
                  Integrations
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-4 sm:px-0">
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                {actions && <div className="flex space-x-2">{actions}</div>}
              </div>
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
