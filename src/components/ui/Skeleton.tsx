import React from 'react';

interface SkeletonProps {
  className?: string;
}

const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
  return (
    <div className={`animate-pulse bg-black/[0.06] rounded-xl ${className}`} />
  );
};

export default Skeleton;
