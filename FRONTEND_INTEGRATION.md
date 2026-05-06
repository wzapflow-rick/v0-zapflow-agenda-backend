# ZAP Scheduling API - Guia de Integracao Frontend

## Base URL
```
https://v0-zapflow-backend.vercel.app/api
```

## Autenticacao
Todas as rotas (exceto `/auth/register`, `/auth/login` e `/public/*`) requerem o header:
```
Authorization: Bearer {token}
```

---

## 1. AUTENTICACAO

### POST /auth/register
Cria novo usuario com estabelecimento.

**Request:**
```json
{
  "name": "Joao Silva",
  "email": "joao@email.com",
  "password": "senha123",
  "phone": "11999999999",
  "establishmentName": "Barbearia do Joao"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "Joao Silva",
      "email": "joao@email.com",
      "phone": "11999999999",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "establishment": {
        "id": "uuid",
        "name": "Barbearia do Joao",
        "slug": "barbearia-do-joao",
        "timezone": "America/Sao_Paulo",
        "slotDuration": 30,
        "workingHours": {...}
      }
    },
    "token": "jwt_token_here"
  }
}
```

### POST /auth/login
**Request:**
```json
{
  "email": "joao@email.com",
  "password": "senha123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "Joao Silva",
      "email": "joao@email.com",
      "establishment": {...}
    },
    "token": "jwt_token_here"
  }
}
```

### GET /auth/me
Retorna dados do usuario autenticado.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Joao Silva",
    "email": "joao@email.com",
    "phone": "11999999999",
    "establishmentId": "uuid",
    "establishment": {
      "id": "uuid",
      "name": "Barbearia do Joao",
      "slug": "barbearia-do-joao"
    },
    "subscription": {
      "id": "uuid",
      "status": "ACTIVE",
      "plan": {
        "id": "uuid",
        "name": "Pro",
        "price": 99.90
      }
    }
  }
}
```

---

## 2. ESTABELECIMENTO

### GET /establishments
Retorna estabelecimento do usuario logado.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Barbearia do Joao",
    "slug": "barbearia-do-joao",
    "description": "A melhor barbearia da cidade",
    "phone": "11999999999",
    "email": "contato@barbearia.com",
    "address": "Rua das Flores, 123",
    "city": "Sao Paulo",
    "state": "SP",
    "zipCode": "01234-567",
    "logoUrl": "https://...",
    "coverUrl": "https://...",
    "timezone": "America/Sao_Paulo",
    "slotDuration": 30,
    "workingHours": {
      "monday": { "isOpen": true, "openTime": "09:00", "closeTime": "18:00" },
      "tuesday": { "isOpen": true, "openTime": "09:00", "closeTime": "18:00" },
      "wednesday": { "isOpen": true, "openTime": "09:00", "closeTime": "18:00" },
      "thursday": { "isOpen": true, "openTime": "09:00", "closeTime": "18:00" },
      "friday": { "isOpen": true, "openTime": "09:00", "closeTime": "18:00" },
      "saturday": { "isOpen": true, "openTime": "09:00", "closeTime": "13:00" },
      "sunday": { "isOpen": false, "openTime": "09:00", "closeTime": "13:00" }
    },
    "_count": {
      "professionals": 5,
      "services": 10,
      "clients": 150,
      "appointments": 500
    }
  }
}
```

### PUT /establishments
Atualiza estabelecimento do usuario logado.

**Request:**
```json
{
  "name": "Barbearia do Joao - Atualizada",
  "description": "Nova descricao",
  "phone": "11988888888",
  "workingHours": {
    "monday": { "isOpen": true, "openTime": "08:00", "closeTime": "19:00" }
  }
}
```

---

## 3. PROFISSIONAIS

### GET /professionals
Lista profissionais do estabelecimento.

**Query Params:**
- `page` (default: 1)
- `limit` (default: 10)
- `search` (busca por nome/email)
- `active` (true/false)

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Carlos Barbeiro",
      "email": "carlos@email.com",
      "phone": "11977777777",
      "avatar": "https://...",
      "bio": "Especialista em cortes modernos",
      "active": true,
      "workingHours": {...},
      "createdAt": "2024-01-01T00:00:00.000Z",
      "services": [
        {
          "service": {
            "id": "uuid",
            "name": "Corte Masculino",
            "price": 45.00
          }
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "totalPages": 1
  }
}
```

### POST /professionals
**Request:**
```json
{
  "name": "Carlos Barbeiro",
  "email": "carlos@email.com",
  "phone": "11977777777",
  "avatar": "https://...",
  "bio": "Especialista em cortes",
  "specialties": ["Corte masculino", "Barba"],
  "workingHours": {
    "monday": { "enabled": true, "start": "09:00", "end": "18:00" }
  }
}
```

### GET /professionals/{id}
### PUT /professionals/{id}
### DELETE /professionals/{id}

---

## 4. SERVICOS

### GET /services
Lista servicos do estabelecimento.

**Query Params:**
- `page`, `limit`, `search`, `active`, `category`

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Corte Masculino",
      "description": "Corte tradicional ou moderno",
      "price": 45.00,
      "duration": 30,
      "category": "Cabelo",
      "active": true,
      "professionals": [
        {
          "professional": {
            "id": "uuid",
            "name": "Carlos Barbeiro"
          }
        }
      ]
    }
  ],
  "pagination": {...}
}
```

### POST /services
**Request:**
```json
{
  "name": "Corte Masculino",
  "description": "Corte tradicional ou moderno",
  "price": 45.00,
  "duration": 30,
  "category": "Cabelo"
}
```

### POST /services/{id}/professionals
Atribui profissionais a um servico.

**Request:**
```json
{
  "professionalIds": ["uuid1", "uuid2"]
}
```

### GET /services/{id}
### PUT /services/{id}
### DELETE /services/{id}

---

## 5. CLIENTES

### GET /clients
Lista clientes do estabelecimento.

**Query Params:**
- `page`, `limit`, `search`

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Maria Silva",
      "email": "maria@email.com",
      "phone": "11966666666",
      "birthDate": "1990-05-15",
      "notes": "Cliente VIP",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "_count": {
        "appointments": 10
      }
    }
  ],
  "pagination": {...}
}
```

### POST /clients
**Request:**
```json
{
  "name": "Maria Silva",
  "email": "maria@email.com",
  "phone": "11966666666",
  "birthDate": "1990-05-15",
  "notes": "Cliente VIP"
}
```

### GET /clients/{id}
### PUT /clients/{id}
### DELETE /clients/{id}

### GET /clients/{id}/history
Retorna historico de agendamentos do cliente.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "appointments": [
      {
        "id": "uuid",
        "date": "2024-01-15",
        "startTime": "10:00",
        "endTime": "10:30",
        "status": "COMPLETED",
        "price": 45.00,
        "professional": {
          "id": "uuid",
          "name": "Carlos Barbeiro"
        },
        "service": {
          "id": "uuid",
          "name": "Corte Masculino"
        }
      }
    ],
    "stats": {
      "totalAppointments": 10,
      "completedAppointments": 8,
      "totalSpent": 450.00
    },
    "pagination": {...}
  }
}
```

---

## 6. AGENDAMENTOS

### GET /appointments
Lista agendamentos do estabelecimento.

**Query Params:**
- `page`, `limit`
- `status` (PENDING, CONFIRMED, CANCELLED, COMPLETED, NO_SHOW)
- `professionalId`
- `clientId`
- `startDate` (YYYY-MM-DD)
- `endDate` (YYYY-MM-DD)

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "date": "2024-01-15",
      "startTime": "10:00",
      "endTime": "10:30",
      "status": "CONFIRMED",
      "price": 45.00,
      "notes": "Cliente pediu corte curto",
      "professional": {
        "id": "uuid",
        "name": "Carlos Barbeiro",
        "avatar": "https://..."
      },
      "service": {
        "id": "uuid",
        "name": "Corte Masculino",
        "duration": 30
      },
      "client": {
        "id": "uuid",
        "name": "Maria Silva",
        "phone": "11966666666"
      },
      "createdAt": "2024-01-10T00:00:00.000Z"
    }
  ],
  "pagination": {...}
}
```

### POST /appointments
**Request:**
```json
{
  "professionalId": "uuid",
  "serviceId": "uuid",
  "clientId": "uuid",
  "date": "2024-01-15",
  "startTime": "10:00",
  "notes": "Cliente pediu corte curto"
}
```

### GET /appointments/{id}
### PUT /appointments/{id}
### DELETE /appointments/{id}

### PUT /appointments/{id}/status
Atualiza status do agendamento.

**Request:**
```json
{
  "status": "CONFIRMED"
}
```

**Status disponiveis:**
- `PENDING` - Pendente
- `CONFIRMED` - Confirmado
- `CANCELLED` - Cancelado
- `COMPLETED` - Concluido
- `NO_SHOW` - Cliente nao compareceu

### GET /appointments/slots
Retorna slots disponiveis para agendamento.

**Query Params (obrigatorios):**
- `professionalId`
- `serviceId`
- `date` (YYYY-MM-DD)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "date": "2024-01-15",
    "slots": [
      { "time": "09:00", "available": true },
      { "time": "09:30", "available": true },
      { "time": "10:00", "available": false },
      { "time": "10:30", "available": true }
    ]
  }
}
```

---

## 7. ASSINATURAS

### GET /subscriptions
Retorna assinatura atual do usuario.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "ACTIVE",
    "currentPeriodStart": "2024-01-01T00:00:00.000Z",
    "currentPeriodEnd": "2024-02-01T00:00:00.000Z",
    "plan": {
      "id": "uuid",
      "name": "Pro",
      "price": 99.90,
      "features": ["Agendamentos ilimitados", "Relatorios"]
    }
  }
}
```

### GET /plans
Lista planos disponiveis.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Free",
      "price": 0,
      "features": ["Ate 50 agendamentos/mes"]
    },
    {
      "id": "uuid",
      "name": "Pro",
      "price": 99.90,
      "features": ["Agendamentos ilimitados", "Relatorios"]
    }
  ]
}
```

---

## 8. ROTAS PUBLICAS (Sem Autenticacao)

### GET /public/establishments/{slug}
Retorna dados publicos do estabelecimento.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Barbearia do Joao",
    "slug": "barbearia-do-joao",
    "description": "A melhor barbearia",
    "phone": "11999999999",
    "address": "Rua das Flores, 123",
    "logoUrl": "https://...",
    "coverUrl": "https://...",
    "workingHours": {...},
    "professionals": [
      {
        "id": "uuid",
        "name": "Carlos Barbeiro",
        "avatar": "https://...",
        "services": [...]
      }
    ],
    "services": [
      {
        "id": "uuid",
        "name": "Corte Masculino",
        "price": 45.00,
        "duration": 30
      }
    ]
  }
}
```

### GET /public/establishments/{slug}/slots
Retorna slots disponiveis (publico).

**Query Params:**
- `professionalId` (obrigatorio)
- `serviceId` (obrigatorio)
- `date` (obrigatorio, YYYY-MM-DD)

### POST /public/establishments/{slug}/book
Cria agendamento publico (cliente externo).

**Request:**
```json
{
  "professionalId": "uuid",
  "serviceId": "uuid",
  "date": "2024-01-15",
  "startTime": "10:00",
  "clientName": "Jose Santos",
  "clientEmail": "jose@email.com",
  "clientPhone": "11955555555",
  "notes": "Primeira vez"
}
```

---

## TIPOS TYPESCRIPT

```typescript
// Enums
type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
type SubscriptionStatus = 'ACTIVE' | 'CANCELLED' | 'PAST_DUE' | 'TRIALING';

// Interfaces principais
interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  establishmentId?: string;
  establishment?: Establishment;
  subscription?: Subscription;
  createdAt: string;
  updatedAt: string;
}

interface Establishment {
  id: string;
  name: string;
  slug: string;
  description?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  logoUrl?: string;
  coverUrl?: string;
  timezone: string;
  slotDuration: number;
  workingHours: WorkingHours;
  _count?: {
    professionals: number;
    services: number;
    clients: number;
    appointments: number;
  };
}

interface WorkingHours {
  [day: string]: {
    isOpen: boolean;
    openTime: string;
    closeTime: string;
  };
}

interface Professional {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  bio?: string;
  active: boolean;
  workingHours?: WorkingHours;
  services?: { service: Service }[];
  createdAt: string;
}

interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration: number;
  category?: string;
  active: boolean;
  professionals?: { professional: Professional }[];
}

interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  notes?: string;
  createdAt: string;
  _count?: {
    appointments: number;
  };
}

interface Appointment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  price: number;
  notes?: string;
  professional: Professional;
  service: Service;
  client: Client;
  createdAt: string;
}

interface Subscription {
  id: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  plan: Plan;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  features: string[];
}

// Response padrao
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Slots
interface TimeSlot {
  time: string;
  available: boolean;
}

interface SlotsResponse {
  date: string;
  slots: TimeSlot[];
}
```

---

## ERROS

Todas as respostas de erro seguem o formato:
```json
{
  "success": false,
  "error": "Mensagem de erro"
}
```

**Codigos HTTP:**
- `400` - Bad Request (dados invalidos)
- `401` - Unauthorized (token invalido/ausente)
- `403` - Forbidden (sem permissao)
- `404` - Not Found (recurso nao encontrado)
- `409` - Conflict (ex: horario ja ocupado)
- `500` - Internal Server Error
