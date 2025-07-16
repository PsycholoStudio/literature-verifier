import { render, screen } from '@testing-library/react';
import App from './App';

test('renders literature verifier app', () => {
  render(<App />);
  const titleElement = screen.getByText(/Citation Checker/i);
  expect(titleElement).toBeInTheDocument();
});
