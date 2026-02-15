import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Home } from './pages/Home';
// import { Chat } from './components/Chat';
import './index.css';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Home />
      {/* <Chat />       */}
    </QueryClientProvider>
  );
}

export default App;
