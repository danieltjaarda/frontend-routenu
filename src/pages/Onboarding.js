import React from 'react';
import OnboardingModal from '../components/OnboardingModal';
import { useNavigate } from 'react-router-dom';
import './Onboarding.css';

function Onboarding() {
  const navigate = useNavigate();

  const handleComplete = () => {
    navigate('/vandaag');
  };

  return (
    <div className="onboarding-page">
      <OnboardingModal onComplete={handleComplete} forceVisible={true} />
    </div>
  );
}

export default Onboarding;

