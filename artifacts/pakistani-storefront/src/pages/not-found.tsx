import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">
              404 Page Not Found
            </h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            This page is not part of the storefront.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex rounded-md bg-[#6B2447] px-4 py-2 text-sm font-semibold text-white"
          >
            Return to the home page
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
