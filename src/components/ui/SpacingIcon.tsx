import React, { forwardRef } from 'react';
import { Space, LucideProps } from 'lucide-react';

export const SpacingIcon = forwardRef<SVGSVGElement, LucideProps>(({ className, size = 16, ...props }, ref) => {
    return <Space ref={ref} className={className} size={size} {...props} />;
});

SpacingIcon.displayName = 'SpacingIcon';
