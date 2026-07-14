# Ticket Management System

A full-stack ticket management system built with Spring Boot and React, featuring role-based access control, multi-language support (English / Dari / Pashto), real-time notifications, SLA tracking, and analytical dashboards.

## Features

- **Role-based access**: Admin, Support Staff, and Organization/End User roles with distinct permissions and interfaces
- **Ticket lifecycle**: Create, assign, track, comment, and resolve support tickets with status transitions
- **Real-time notifications**: WebSocket (STOMP) push for ticket events, with persistent database fallback
- **Multi-language UI**: English, Dari, and Pashto with RTL support
- **SLA tracking**: Configurable response and resolve time thresholds with violation detection
- **Secure authentication**: JWT with HttpOnly cookies, refresh token rotation, account lockout, and rate limiting
- **File attachments**: Upload and download ticket attachments with magic bytes validation and pluggable storage (local or S3)
- **Audit logging**: Complete trail of all system actions for compliance and debugging
- **Analytics dashboards**: Role-specific dashboards with charts and aggregated statistics
- **Reports**: Government-themed PDF and CSV reports with ticket distribution data
- **i18n**: Full internationalization across all pages and components

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Java 21, Spring Boot 4.0.5, Spring Security, Spring Data JPA |
| Database | PostgreSQL 17, Redis 7 |
| ORM | Hibernate 7.2 |
| Migrations | Flyway (12 migrations) |
| Frontend | React 18, TypeScript, Vite 8, Tailwind CSS 4 |
| UI Library | PrimeReact 10, ApexCharts, Recharts |
| Auth | JWT (JJWT 0.12.5), BCrypt, HttpOnly cookies |
| Docs | OpenAPI / Swagger UI |
| Monitoring | Micrometer, Prometheus, Sentry |
| Containerization | Docker, Docker Compose |

## Quick Start

### Prerequisites
- Java 21+
- Node.js 20+
- PostgreSQL 16+
- Redis 7+ (optional, for rate limiting)

### Backend
```bash
# Set environment variables
export DB_PASSWORD=your_password
export JWT_SECRET=your-32-char-secret

# Run
mvn spring-boot:run
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Docker (full stack)
```bash
docker compose up -d --build
```

## Documentation

- [Project Documentation](PROJECT_DOCUMENTATION.md) — Complete system documentation
- [Architecture](PROJECT_ARCHITECTURE.md) — Architecture decisions and design
- [Module Explanations](MODULE_EXPLANATION.md) — Deep dives into each module
- [Deployment Guide](DEPLOYMENT_GUIDE.md) — Linux deployment instructions
- [Deployment Steps](DEPLOYMENT_STEPS.md) — Step-by-step deployment walkthrough

## Deployment

The system is deployed at [support.mcitservices.af](https://support.mcitservices.af) with Docker Compose on Ubuntu, behind an Nginx reverse proxy with Let's Encrypt SSL.

## License

MIT
