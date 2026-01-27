import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Custom error class to attach response data
class ApiError extends Error {
  status: number;
  data: any;
  
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let data: any;
    const contentType = res.headers.get('content-type');
    
    try {
      // Try to parse JSON response
      if (contentType?.includes('application/json')) {
        data = await res.json();
        const message = data.message || res.statusText;
        throw new ApiError(message, res.status, data);
      }
    } catch (parseError) {
      // If JSON parsing fails, fall back to text
      if (!(parseError instanceof ApiError)) {
        const text = (await res.text()) || res.statusText;
        throw new ApiError(text, res.status);
      }
      throw parseError;
    }
    
    const text = (await res.text()) || res.statusText;
    throw new ApiError(text, res.status);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
