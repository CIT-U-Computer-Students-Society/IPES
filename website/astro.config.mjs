// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import mermaid from 'astro-mermaid';

// https://astro.build/config
export default defineConfig({
	site: 'https://cit-u-computer-students-society.github.io',
	base: '/IPES/',
	vite: {
		plugins: [tailwindcss()],
	},
	integrations: [
		react(),
		mermaid({
			autoTheme: true,
		}),
		starlight({
			title: 'IPES',
			favicon: '/favicon.svg',
			description: 'Individual Performance Evaluation System — Official Landing Page and User Manual for CIT-U Student Organizations',
			logo: {
				src: './src/assets/ipes-logo-colored.svg',
				alt: 'IPES Logo',
			},
			customCss: ['./src/styles/custom.css'],
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/CIT-U-Computer-Students-Society/IPES' }
			],
			sidebar: [
				{
					label: 'Overview',
					items: [
						{ label: 'What is IPES?', slug: 'overview' },
					],
				},
				{
					label: 'Officer & Member Guide',
					items: [
						{ label: '1. Getting Started & Login', slug: 'officer/getting-started' },
						{ label: '2. Dashboard & Task Queue', slug: 'officer/dashboard' },
						{ label: '3. Accomplishment Portfolio', slug: 'officer/accomplishments' },
						{ label: '4. Answering Evaluations', slug: 'officer/evaluations' },
						{ label: '5. Viewing Performance Results', slug: 'officer/results' },
					],
				},
				{
					label: 'Administrator Guide',
					items: [
						{ label: '1. Organization & Units Setup', slug: 'admin/organization-setup' },
						{ label: '2. Members & Role Permissions', slug: 'admin/members-and-roles' },
						{ label: '3. Evaluation Form Builder', slug: 'admin/form-builder' },
						{ label: '4. Assignment Rules Engine', slug: 'admin/assignment-rules' },
						{ label: '5. Accomplishment Verification', slug: 'admin/accomplishment-verification' },
						{ label: '6. Cycle Progress & Results Release', slug: 'admin/cycle-management' },
						{ label: '7. Audit Trail Inspection', slug: 'admin/audit-logs' },
					],
				},
				{
					label: 'Resources & FAQ',
					items: [
						{ label: 'Confidentiality & Anonymity', slug: 'policies/anonymity' },
						{ label: 'Frequently Asked Questions', slug: 'faq' },
					],
				},
			],
		}),
	],
});
