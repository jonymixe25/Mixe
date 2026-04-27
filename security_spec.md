# Security Specification - Voz Mixe

## 1. Data Invariants
- **User Integrity**: A user profile MUST match the `request.auth.uid`. Roles can only be upgraded by existing admins.
- **Stream Ownership**: Only the creator of a stream (or an admin) can modify its core properties (title, description, status).
- **Relational Consistency**: Join requests and invitations MUST refer to an existing stream.
- **Message Authenticity**: Chat messages MUST have a `userId` matching the sender's authenticated UID.
- **PII Protection**: User email and private metadata MUST only be accessible to the owner or an admin.
- **Immutability**: `createdAt` and `ownerId` fields MUST NOT change after creation.
- **Temporal Integrity**: `updatedAt` and `createdAt` MUST use `request.time` (server timestamp).

## 2. The "Dirty Dozen" Payloads (Attack Vectors)

### P1: Role Escalation (Identity Spoofing)
A regular user attempts to create a profile with `role: "admin"`.
```json
{
  "uid": "user123",
  "displayName": "Hacker",
  "email": "hacker@evil.com",
  "role": "admin",
  "createdAt": "request.time"
}
```
**Expected Result**: `PERMISSION_DENIED` (Create rule enforces `incoming().role == 'user'`).

### P2: Stream Hijacking
A user attempts to update a stream they don't own.
```json
// Update to streams/other_user_stream_id
{
  "title": "Owned by Hacker",
  "status": "ended"
}
```
**Expected Result**: `PERMISSION_DENIED` (Update rule requires `isUser(existing().userId) || isAdmin()`).

### P3: Resource Poisoning (ID Injection)
Attempting to create a document with a 2MB string as an ID.
**Expected Result**: `PERMISSION_DENIED` (Handled by `isValidId(streamId)`).

### P4: Value Poisoning (Denial of Wallet)
Attempting to set `viewerCount` to `999999999` in a single update.
```json
{
  "viewerCount": 999999999
}
```
**Expected Result**: `PERMISSION_DENIED` (Update rule enforces `math.abs(incoming().viewerCount - existing().viewerCount) == 1`).

### P5: Social Engineering (Invitation Forgery)
A random user attempts to create an invitation for a stream they don't own.
```json
// Create in streams/host_id/invitations/inv1
{
  "to": "target_user_id",
  "status": "pending",
  "roomId": "secret_room"
}
```
**Expected Result**: `PERMISSION_DENIED` (Create rule requires requester to be the host of the stream).

### P6: Message Spoofing
User A sends a message claiming to be User B.
```json
{
  "userId": "UserB_UID",
  "userName": "User B",
  "text": "I am User B",
  "createdAt": "request.time"
}
```
**Expected Result**: `PERMISSION_DENIED` (Create rule enforces `incoming().userId == request.auth.uid`).

### P7: PII Leak (Unauthorized Read)
User A attempts to read User B's private contact list.
**Expected Result**: `PERMISSION_DENIED` (Read rule for `contacts` requires `isUser(uid) || isAdmin()`).

### P8: Orphaned Write (Stateless Join)
A user attempts to join a stream that does not exist.
**Expected Result**: `PERMISSION_DENIED` (Handled by checking `exists()` on the parent stream path).

### P9: Shadow Update (Ghost Fields)
Adding `isVerified: true` to a news article update.
```json
{
  "title": "New Title",
  "isVerified": true
}
```
**Expected Result**: `PERMISSION_DENIED` (Update rule uses `affectedKeys().hasOnly(...)`).

### P10: Temporal Spoofing
Attempting to set `createdAt` to a date in the past.
```json
{
  "title": "Old News",
  "createdAt": "2020-01-01T00:00:00Z"
}
```
**Expected Result**: `PERMISSION_DENIED` (Rule enforces `incoming().createdAt == request.time`).

### P11: Public Query Scraping
Attempting to `list` all global settings without being an admin (though settings are mostly public, certain fields should be guarded).
**Expected Result**: `PERMISSION_DENIED` (If PII were in settings, but currently settings are public read. We will harden to only allow `settings/global`).

### P12: Terminal State Bypass
Attempting to restart a stream that has already ended.
```json
{
  "status": "live"
}
```
**Expected Result**: `PERMISSION_DENIED` (Update rule prevents changing `status` from `ended` back to `live`).

## 3. Test Runner (Conceptual logic)
The following rules will be implemented to ensure all above payloads are rejected.
- `isValidUser`
- `isValidStream`
- `isValidNews`
- `isValidMessage`
- `isAdmin` (hardened)
- `isVerified` (checking `email_verified`)
