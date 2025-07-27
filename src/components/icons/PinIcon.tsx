import React from 'react';

const PinIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M12.37.242a.75.75 0 00-1.241.011L9.623 3.656a1.5 1.5 0 01-.893.893L5.074 5.89a.75.75 0 00-.422 1.36l2.94 1.708a1.5 1.5 0 01.611 1.283L8 16.5a.75.75 0 00.91.73L12 16.14l3.09.99a.75.75 0 00.91-.73l-.2-6.25a1.5 1.5 0 01.61-1.283l2.94-1.708a.75.75 0 00-.421-1.36l-3.657-1.34a1.5 1.5 0 01-.892-.893L12.37.242z" />
        <path d="M12 17.155V23.25a.75.75 0 001.5 0v-5.69l-1.5-.405z" />
    </svg>
);

export default PinIcon;