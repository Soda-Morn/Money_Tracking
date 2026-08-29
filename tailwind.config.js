/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eaf4f1',
          100: '#cde6dd',
          200: '#9ccdbe',
          300: '#6bb19d',
          400: '#439279',
          500: '#227560',
          600: '#0d4d40',
          700: '#0a3d33',
          800: '#082f27',
          900: '#06231c',
          950: '#041712',
        },
        secondary: {
          50: '#eef5f9',
          100: '#d5e7f0',
          200: '#b1d0e2',
          300: '#86b4cd',
          400: '#6a9cba',
          500: '#4d88ac',
          600: '#3d6f8e',
          700: '#325a73',
          800: '#2a4a5e',
          900: '#243d4d',
          950: '#16262f',
        },
        tertiary: {
          50: '#f7f0ea',
          100: '#ecdac8',
          200: '#d9b48f',
          300: '#c08e5c',
          400: '#955f37',
          500: '#7a4a29',
          600: '#663a21',
          700: '#502d1a',
          800: '#3c2214',
          900: '#2b190f',
          950: '#1a0f09',
        }
      }
    },
  },
  plugins: [],
}
