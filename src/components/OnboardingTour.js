import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import './OnboardingTour.css';

const TOUR_STEPS = [
  {
    id: 'startpoint',
    title: 'Stap 1: Startpunt instellen',
    description: 'Stel eerst je startpunt in. Dit is het adres waar je routes beginnen.',
    targetPage: '/profiel',
    action: 'Vul je startpunt adres in en klik op "Opslaan"',
    checkComplete: async (userId) => {
      const { data } = await supabase
        .from('user_profiles')
        .select('start_address, start_coordinates')
        .eq('user_id', userId)
        .maybeSingle();
      return data && data.start_address && data.start_coordinates;
    }
  },
  {
    id: 'driver',
    title: 'Stap 2: Chauffeur toevoegen',
    description: 'Voeg eerst een chauffeur toe voordat je routes kunt maken.',
    targetPage: '/chauffeurs',
    action: 'Klik op "Chauffeur toevoegen"',
    checkComplete: async (userId) => {
      const { data } = await supabase
        .from('drivers')
        .select('id')
        .eq('user_id', userId)
        .not('email', 'is', null) // Only count drivers with an email (actual accounts)
        .limit(1);
      return data && data.length > 0;
    }
  },
  {
    id: 'vehicle',
    title: 'Stap 3: Voertuig toevoegen',
    description: 'Voeg nu een voertuig toe om routes te kunnen berekenen.',
    targetPage: '/voertuigen',
    action: 'Klik op "Voertuig toevoegen"',
    checkComplete: async (userId) => {
      const { data } = await supabase
        .from('vehicles')
        .select('id')
        .eq('user_id', userId)
        .limit(1);
      return data && data.length > 0;
    }
  },
  {
    id: 'route',
    title: 'Stap 4: Route aanmaken',
    description: 'Maak je eerste route aan door op "Nieuwe route" te klikken en een datum te selecteren.',
    targetPage: '/routes',
    action: 'Klik op "Nieuwe route"',
    checkComplete: async (userId) => {
      const { data } = await supabase
        .from('routes')
        .select('id')
        .eq('user_id', userId)
        .limit(1);
      return data && data.length > 0;
    }
  },
  {
    id: 'stop',
    title: 'Stap 5: Stop toevoegen',
    description: 'Voeg een stop toe aan je route door op "Stop toevoegen" te klikken.',
    targetPage: '/route-aanmaken',
    action: 'Klik op "Stop toevoegen"',
    checkComplete: async (userId) => {
      const { data } = await supabase
        .from('routes')
        .select('stops')
        .eq('user_id', userId)
        .limit(1);
      if (data && data.length > 0) {
        const route = data[0];
        return route.stops && Array.isArray(route.stops) && route.stops.length > 0;
      }
      return false;
    }
  }
];

function OnboardingTour({ onComplete, forceStart = false }) {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  // Handle force start separately
  useEffect(() => {
    if (forceStart && currentUser) {
      // Check if startpoint is set before starting tour (skip for drivers)
      const checkStartpoint = async () => {
        // Check if user is a driver - drivers don't need startpoint
        const { data: driverData } = await supabase
          .from('drivers')
          .select('id, email')
          .eq('user_id', currentUser.id)
          .maybeSingle();

        const isDriver = driverData && driverData.email; // Only drivers with email accounts

        if (!isDriver) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('start_address, start_coordinates')
            .eq('user_id', currentUser.id)
            .maybeSingle();

          if (!profile || !profile.start_address || !profile.start_coordinates) {
            // Startpoint not set, navigate to profile first (only for non-drivers)
            navigate('/profiel');
            setIsVisible(true);
            setCurrentStep(0); // Start with startpoint step
            setHasChecked(true);
            return;
          }
        }

        // Startpoint is set (or user is driver), start from driver step
        setIsVisible(true);
        setCurrentStep(1); // Start from step 1 (driver), skip startpoint step
        const step = TOUR_STEPS[1];
        if (location.pathname !== step.targetPage) {
          navigate(step.targetPage);
        }
        setHasChecked(true);
      };
      checkStartpoint();
    }
  }, [forceStart, currentUser, navigate, location.pathname]);

  useEffect(() => {
    const checkTourStatus = async () => {
      if (!currentUser || hasChecked || forceStart) return;

      try {
        setHasChecked(true);

        // Check if user is a driver - drivers don't need startpoint
        const { data: driverData } = await supabase
          .from('drivers')
          .select('id, email')
          .eq('user_id', currentUser.id)
          .maybeSingle();

        const isDriver = driverData && driverData.email; // Only drivers with email accounts

        // Check if tour is already completed
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('onboarding_completed, start_address, start_coordinates')
          .eq('user_id', currentUser.id)
          .maybeSingle();

        // Handle errors gracefully - 400 errors might occur if RLS policies aren't set up yet
        // or if the user was just created and profile doesn't exist yet
        if (profileError) {
          // PGRST116 = no rows returned (profile doesn't exist yet - this is OK)
          if (profileError.code === 'PGRST116') {
            // Profile doesn't exist yet, which is fine for new users
            // Navigate to profile page to set startpoint
            if (location.pathname !== '/profiel') {
              navigate('/profiel');
            }
            return;
          }
          
          // 400 errors might be RLS policy issues - log but don't crash
          if (profileError.code === '400' || profileError.status === 400) {
            console.warn('Tour status check returned 400 - this might be a RLS policy issue:', profileError);
            return;
          }
          
          // For other errors, log and return
          console.error('Error checking tour status:', profileError);
          return;
        }

        // Don't start if already completed
        if (profile?.onboarding_completed === true) {
          return; // Tour already completed
        }

        // Check if startpoint is set - if not, navigate to profile page first (skip for drivers)
        if (!isDriver && (!profile || !profile.start_address || !profile.start_coordinates)) {
          // Startpoint not set yet, navigate to profile page (only for non-drivers)
          if (location.pathname !== '/profiel') {
            navigate('/profiel');
          }
          // Don't start tour yet, wait for startpoint to be set
          return;
        }

        // Check if user is new (created in last 24 hours)
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const userCreatedAt = new Date(user.created_at);
          const hoursSinceCreation = (Date.now() - userCreatedAt.getTime()) / (1000 * 60 * 60);
          
          // Only show tour for users created in last 24 hours
          if (hoursSinceCreation > 24) {
            return;
          }
        }

        // Start tour (startpoint is set, so start from step 1 - driver)
        setIsVisible(true);
        setCurrentStep(1); // Start from step 1 (driver), skip startpoint step
        const step = TOUR_STEPS[1];
        if (location.pathname !== step.targetPage) {
          navigate(step.targetPage);
        }
      } catch (error) {
        console.error('Error checking tour status:', error);
        setHasChecked(false); // Reset on error so it can retry
      }
    };

    checkTourStatus();
  }, [currentUser, hasChecked, forceStart, location.pathname, navigate]);

  useEffect(() => {
    if (isVisible && currentStep < TOUR_STEPS.length) {
      navigateToStep(currentStep);
    }
  }, [currentStep, isVisible]);

  // Check if startpoint was just saved (when on profile page and tour is waiting)
  useEffect(() => {
    const checkStartpointSaved = async () => {
      if (!currentUser || !isVisible || currentStep !== 0 || location.pathname !== '/profiel') {
        return;
      }

      try {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('start_address, start_coordinates')
          .eq('user_id', currentUser.id)
          .maybeSingle();

        if (profile && profile.start_address && profile.start_coordinates) {
          // Startpoint is now set, move to next step (driver)
          setTimeout(() => {
            setCurrentStep(1);
            const step = TOUR_STEPS[1];
            if (location.pathname !== step.targetPage) {
              navigate(step.targetPage);
            }
          }, 1500);
        }
      } catch (error) {
        console.error('Error checking startpoint:', error);
      }
    };

    // Check periodically when on profile page and waiting for startpoint
    if (location.pathname === '/profiel' && currentStep === 0 && isVisible) {
      const interval = setInterval(checkStartpointSaved, 2000);
      return () => clearInterval(interval);
    }
  }, [currentUser, isVisible, currentStep, location.pathname, navigate]);

  useEffect(() => {
    if (isVisible && currentStep < TOUR_STEPS.length) {
      // Check completion after a short delay to allow page to load
      const timer = setTimeout(() => {
        checkStepCompletion();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentStep, isVisible, location.pathname]);

  const navigateToStep = (stepIndex) => {
    if (stepIndex >= TOUR_STEPS.length) return;
    const step = TOUR_STEPS[stepIndex];
    if (location.pathname !== step.targetPage) {
      navigate(step.targetPage);
    }
  };

  const checkStepCompletion = async () => {
    if (!currentUser || isChecking) return;
    
    setIsChecking(true);
    try {
      const step = TOUR_STEPS[currentStep];
      if (step.checkComplete) {
        const isComplete = await step.checkComplete(currentUser.id);
        
        if (isComplete) {
          // Move to next step
          if (currentStep < TOUR_STEPS.length - 1) {
            setTimeout(() => {
              setCurrentStep(currentStep + 1);
            }, 1500);
          } else {
            // Tour completed
            setTimeout(() => {
              completeTour();
            }, 1500);
          }
        }
      }
    } catch (error) {
      console.error('Error checking step completion:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const completeTour = async () => {
    if (!currentUser) return;

    try {
      // Mark tour as completed
      const { data: existing, error: selectError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (selectError && selectError.code !== 'PGRST116') {
        console.error('Error checking profile:', selectError);
      }

      if (existing) {
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ onboarding_completed: true })
          .eq('user_id', currentUser.id);

        if (updateError) {
          console.error('Error updating profile:', updateError);
          throw updateError;
        }
      } else {
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            user_id: currentUser.id,
            onboarding_completed: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (insertError) {
          console.error('Error inserting profile:', insertError);
          throw insertError;
        }
      }

      setIsVisible(false);
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Error completing tour:', error);
      // Still hide the tour even if there's an error
      setIsVisible(false);
      if (onComplete) {
        onComplete();
      }
    }
  };

  const handleSkip = async () => {
    // Mark as completed when skipping
    await completeTour();
  };

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTour();
    }
  };

  if (!isVisible || currentStep >= TOUR_STEPS.length) {
    return null;
  }

  const step = TOUR_STEPS[currentStep];
  const progress = ((currentStep + 1) / TOUR_STEPS.length) * 100;

  return (
    <div className="onboarding-tour-overlay">
      <div className="onboarding-tour-content">
        <div className="tour-header">
          <div className="tour-progress">
            <div className="tour-progress-bar" style={{ width: `${progress}%` }}></div>
          </div>
          <div className="tour-step-indicator">
            Stap {currentStep + 1} van {TOUR_STEPS.length}
          </div>
        </div>
        
        <div className="tour-body">
          <h3 className="tour-title">{step.title}</h3>
          <p className="tour-description">{step.description}</p>
          <p className="tour-action">{step.action}</p>
        </div>

        <div className="tour-footer">
          <button className="tour-btn-skip" onClick={handleSkip}>
            Overslaan
          </button>
          <button className="tour-btn-next" onClick={handleNext}>
            {currentStep === TOUR_STEPS.length - 1 ? 'Voltooien' : 'Volgende'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default OnboardingTour;

