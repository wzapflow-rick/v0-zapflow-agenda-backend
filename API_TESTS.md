# API Tests - Backend ZAP Scheduling

Base URL: `http://localhost:3000/api`

---

## 1. AUTENTICAÇÃO

### 1.1 Registrar Usuário
```
POST /auth/register
Content-Type: application/json

{
  "name": "João Silva",
  "email": "joao@email.com",
  "password": "senha123456"
}
```

**Resposta esperada (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "João Silva",
      "email": "joao@email.com"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 1.2 Login
```
POST /auth/login
Content-Type: application/json

{
  "email": "joao@email.com",
  "password": "senha123456"
}
```

**Resposta esperada (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "João Silva",
      "email": "joao@email.com"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 1.3 Obter Perfil (Autenticado)
```
GET /auth/me
Authorization: Bearer {token}
```

**Resposta esperada (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "João Silva",
    "email": "joao@email.com",
    "establishments": []
  }
}
```

---

## 2. ESTABELECIMENTOS

### 2.1 Criar Estabelecimento
```
POST /establishments
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Barbearia do João",
  "slug": "barbearia-joao",
  "description": "A melhor barbearia da cidade",
  "phone": "11999999999",
  "email": "contato@barbearia.com",
  "address": "Rua das Flores, 123",
  "city": "São Paulo",
  "state": "SP",
  "zipCode": "01234-567",
  "workingHours": {
    "monday": { "start": "09:00", "end": "18:00" },
    "tuesday": { "start": "09:00", "end": "18:00" },
    "wednesday": { "start": "09:00", "end": "18:00" },
    "thursday": { "start": "09:00", "end": "18:00" },
    "friday": { "start": "09:00", "end": "18:00" },
    "saturday": { "start": "09:00", "end": "14:00" },
    "sunday": null
  }
}
```

**Resposta esperada (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Barbearia do João",
    "slug": "barbearia-joao",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### 2.2 Listar Estabelecimentos do Usuário
```
GET /establishments
Authorization: Bearer {token}
```

---

### 2.3 Obter Estabelecimento por ID
```
GET /establishments/{establishmentId}
Authorization: Bearer {token}
```

---

### 2.4 Atualizar Estabelecimento
```
PUT /establishments/{establishmentId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Barbearia Premium do João",
  "description": "Agora com mais serviços!"
}
```

---

### 2.5 Deletar Estabelecimento
```
DELETE /establishments/{establishmentId}
Authorization: Bearer {token}
```

---

## 3. PROFISSIONAIS

### 3.1 Criar Profissional
```
POST /professionals
Authorization: Bearer {token}
Content-Type: application/json

{
  "establishmentId": "{establishmentId}",
  "name": "Carlos Barbeiro",
  "email": "carlos@barbearia.com",
  "phone": "11988888888",
  "specialty": "Cortes masculinos e barba",
  "workingHours": {
    "monday": { "start": "09:00", "end": "18:00" },
    "tuesday": { "start": "09:00", "end": "18:00" },
    "wednesday": { "start": "09:00", "end": "18:00" },
    "thursday": { "start": "09:00", "end": "18:00" },
    "friday": { "start": "09:00", "end": "18:00" },
    "saturday": { "start": "09:00", "end": "14:00" },
    "sunday": null
  }
}
```

**Resposta esperada (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Carlos Barbeiro",
    "email": "carlos@barbearia.com",
    "isActive": true
  }
}
```

---

### 3.2 Listar Profissionais do Estabelecimento
```
GET /professionals?establishmentId={establishmentId}
Authorization: Bearer {token}
```

---

### 3.3 Obter Profissional por ID
```
GET /professionals/{professionalId}
Authorization: Bearer {token}
```

---

### 3.4 Atualizar Profissional
```
PUT /professionals/{professionalId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Carlos Silva Barbeiro",
  "specialty": "Cortes modernos e barba"
}
```

---

### 3.5 Deletar Profissional
```
DELETE /professionals/{professionalId}
Authorization: Bearer {token}
```

---

## 4. SERVIÇOS

### 4.1 Criar Serviço
```
POST /services
Authorization: Bearer {token}
Content-Type: application/json

{
  "establishmentId": "{establishmentId}",
  "name": "Corte Masculino",
  "description": "Corte de cabelo masculino tradicional",
  "duration": 30,
  "price": 45.00,
  "professionalIds": ["{professionalId1}", "{professionalId2}"]
}
```

**Resposta esperada (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Corte Masculino",
    "duration": 30,
    "price": 45.00,
    "isActive": true
  }
}
```

---

### 4.2 Listar Serviços do Estabelecimento
```
GET /services?establishmentId={establishmentId}
Authorization: Bearer {token}
```

---

### 4.3 Obter Serviço por ID
```
GET /services/{serviceId}
Authorization: Bearer {token}
```

---

### 4.4 Atualizar Serviço
```
PUT /services/{serviceId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Corte Masculino Premium",
  "price": 55.00
}
```

---

### 4.5 Deletar Serviço
```
DELETE /services/{serviceId}
Authorization: Bearer {token}
```

---

## 5. CLIENTES

### 5.1 Criar Cliente
```
POST /clients
Authorization: Bearer {token}
Content-Type: application/json

{
  "establishmentId": "{establishmentId}",
  "name": "Pedro Cliente",
  "email": "pedro@email.com",
  "phone": "11977777777",
  "birthDate": "1990-05-15",
  "notes": "Cliente VIP, prefere horários pela manhã"
}
```

**Resposta esperada (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Pedro Cliente",
    "email": "pedro@email.com",
    "phone": "11977777777"
  }
}
```

---

### 5.2 Listar Clientes do Estabelecimento
```
GET /clients?establishmentId={establishmentId}
Authorization: Bearer {token}
```

**Query params opcionais:**
- `page` (default: 1)
- `limit` (default: 20)
- `search` (busca por nome, email ou telefone)

---

### 5.3 Obter Cliente por ID
```
GET /clients/{clientId}
Authorization: Bearer {token}
```

---

### 5.4 Atualizar Cliente
```
PUT /clients/{clientId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Pedro Silva Cliente",
  "notes": "Cliente VIP premium"
}
```

---

### 5.5 Deletar Cliente
```
DELETE /clients/{clientId}
Authorization: Bearer {token}
```

---

## 6. AGENDAMENTOS

### 6.1 Criar Agendamento
```
POST /appointments
Authorization: Bearer {token}
Content-Type: application/json

{
  "establishmentId": "{establishmentId}",
  "professionalId": "{professionalId}",
  "serviceId": "{serviceId}",
  "clientId": "{clientId}",
  "date": "2024-12-20",
  "startTime": "10:00",
  "notes": "Cliente pediu para não usar máquina"
}
```

**Resposta esperada (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "date": "2024-12-20",
    "startTime": "10:00",
    "endTime": "10:30",
    "status": "SCHEDULED",
    "professional": { "name": "Carlos Barbeiro" },
    "service": { "name": "Corte Masculino" },
    "client": { "name": "Pedro Cliente" }
  }
}
```

---

### 6.2 Listar Agendamentos
```
GET /appointments?establishmentId={establishmentId}
Authorization: Bearer {token}
```

**Query params opcionais:**
- `professionalId` - Filtrar por profissional
- `clientId` - Filtrar por cliente
- `status` - Filtrar por status (SCHEDULED, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW)
- `startDate` - Data inicial (YYYY-MM-DD)
- `endDate` - Data final (YYYY-MM-DD)
- `page` (default: 1)
- `limit` (default: 20)

**Exemplo:**
```
GET /appointments?establishmentId={id}&startDate=2024-12-01&endDate=2024-12-31&status=SCHEDULED
```

---

### 6.3 Obter Agendamento por ID
```
GET /appointments/{appointmentId}
Authorization: Bearer {token}
```

---

### 6.4 Atualizar Agendamento
```
PUT /appointments/{appointmentId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "date": "2024-12-21",
  "startTime": "14:00",
  "notes": "Remarcado pelo cliente"
}
```

---

### 6.5 Atualizar Status do Agendamento
```
PATCH /appointments/{appointmentId}/status
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "CONFIRMED"
}
```

**Status disponíveis:**
- `SCHEDULED` - Agendado
- `CONFIRMED` - Confirmado
- `COMPLETED` - Concluído
- `CANCELLED` - Cancelado
- `NO_SHOW` - Não compareceu

---

### 6.6 Obter Slots Disponíveis
```
GET /appointments/available-slots?establishmentId={establishmentId}&professionalId={professionalId}&serviceId={serviceId}&date=2024-12-20
Authorization: Bearer {token}
```

**Resposta esperada (200):**
```json
{
  "success": true,
  "data": {
    "date": "2024-12-20",
    "slots": [
      { "time": "09:00", "available": true },
      { "time": "09:30", "available": true },
      { "time": "10:00", "available": false },
      { "time": "10:30", "available": true },
      { "time": "11:00", "available": true }
    ]
  }
}
```

---

### 6.7 Deletar/Cancelar Agendamento
```
DELETE /appointments/{appointmentId}
Authorization: Bearer {token}
```

---

## 7. ASSINATURAS

### 7.1 Listar Planos Disponíveis
```
GET /subscriptions/plans
Authorization: Bearer {token}
```

**Resposta esperada (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Básico",
      "price": 49.90,
      "maxEstablishments": 1,
      "maxProfessionals": 3,
      "maxClients": 100,
      "features": ["Agendamento online", "Notificações SMS"]
    },
    {
      "id": "uuid",
      "name": "Profissional",
      "price": 99.90,
      "maxEstablishments": 3,
      "maxProfessionals": 10,
      "maxClients": 500,
      "features": ["Tudo do Básico", "Relatórios avançados", "API access"]
    }
  ]
}
```

---

### 7.2 Obter Assinatura Atual
```
GET /subscriptions/current
Authorization: Bearer {token}
```

---

### 7.3 Criar/Atualizar Assinatura
```
POST /subscriptions
Authorization: Bearer {token}
Content-Type: application/json

{
  "planId": "{planId}"
}
```

---

### 7.4 Cancelar Assinatura
```
DELETE /subscriptions/current
Authorization: Bearer {token}
```

---

## 8. ENDPOINTS PÚBLICOS (Sem autenticação)

### 8.1 Obter Estabelecimento por Slug
```
GET /public/establishments/{slug}
```

**Exemplo:**
```
GET /public/establishments/barbearia-joao
```

**Resposta esperada (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Barbearia do João",
    "slug": "barbearia-joao",
    "description": "A melhor barbearia da cidade",
    "phone": "11999999999",
    "address": "Rua das Flores, 123",
    "city": "São Paulo",
    "workingHours": { ... },
    "professionals": [...],
    "services": [...]
  }
}
```

---

### 8.2 Listar Profissionais Públicos
```
GET /public/establishments/{slug}/professionals
```

---

### 8.3 Listar Serviços Públicos
```
GET /public/establishments/{slug}/services
```

---

### 8.4 Obter Slots Disponíveis (Público)
```
GET /public/establishments/{slug}/available-slots?professionalId={professionalId}&serviceId={serviceId}&date=2024-12-20
```

---

### 8.5 Criar Agendamento Público (Cliente externo)
```
POST /public/establishments/{slug}/appointments
Content-Type: application/json

{
  "professionalId": "{professionalId}",
  "serviceId": "{serviceId}",
  "date": "2024-12-20",
  "startTime": "10:00",
  "clientName": "Maria Nova Cliente",
  "clientEmail": "maria@email.com",
  "clientPhone": "11966666666",
  "notes": "Primeira vez no estabelecimento"
}
```

**Resposta esperada (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "date": "2024-12-20",
    "startTime": "10:00",
    "endTime": "10:30",
    "status": "SCHEDULED",
    "confirmationCode": "ABC123"
  },
  "message": "Agendamento criado com sucesso! Você receberá uma confirmação por email."
}
```

---

## CÓDIGOS DE ERRO COMUNS

| Código | Descrição |
|--------|-----------|
| 400 | Bad Request - Dados inválidos |
| 401 | Unauthorized - Token ausente ou inválido |
| 403 | Forbidden - Sem permissão para acessar o recurso |
| 404 | Not Found - Recurso não encontrado |
| 409 | Conflict - Conflito (ex: horário já ocupado) |
| 422 | Unprocessable Entity - Erro de validação |
| 500 | Internal Server Error - Erro interno |

**Formato de erro:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados inválidos",
    "details": [
      { "field": "email", "message": "Email inválido" }
    ]
  }
}
```

---

## FLUXO DE TESTE RECOMENDADO

1. **Registrar usuário** → Guardar o token
2. **Criar estabelecimento** → Guardar o establishmentId
3. **Criar profissional** → Guardar o professionalId
4. **Criar serviço** → Guardar o serviceId (vincular ao profissional)
5. **Criar cliente** → Guardar o clientId
6. **Verificar slots disponíveis** → Escolher horário
7. **Criar agendamento** → Testar conflitos
8. **Atualizar status** → Confirmar/Completar
9. **Testar endpoints públicos** → Usar o slug do estabelecimento
