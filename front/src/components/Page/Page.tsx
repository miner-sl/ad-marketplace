import { type PropsWithChildren, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { backButton } from '@tma.js/sdk-react';

import {OnboardingGuard} from '../OnboardingGuard';

export function Page({ children, back = true, guard = true }: PropsWithChildren<{
  /**
   * True if it is allowed to go back from this page.
   */
  back?: boolean
  guard?: boolean
}>) {
  const navigate = useNavigate();

  useEffect(() => {
    if (back) {
      backButton.show();
      return backButton.onClick(() => {
        navigate(-1);
      });
    }
    backButton.hide();
  }, [back, navigate]);


  if (guard) {
    return <OnboardingGuard>{children}</OnboardingGuard>;
  }

  return <>{children}</>
}
