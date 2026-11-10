# KSYN FitConnect: Enterprise Network Topology and Cloud Infrastructure Documentation
## Section 3.3.X — Enterprise Network Architecture & Multi-Branch Deployment Model
**Thesis Manuscript Reference:** Chapters I, II, and III  
**Project Title:** *DEVELOPMENT OF KSYN FitConnect: A Secure Multi-Tenant Franchise Management System with Role-Based Access Control and Tenant Data Isolation*  
**Institution:** College of Computing and Information Sciences, University of Makati  
**Researchers:** Bautista, Luis Gabriel; Bozar, Merynelle B.; Marquez, Jullia Krisitina C.  

---

## 1. Architectural Overview & Context

Figure 3.X illustrates the official **Enterprise Network Topology** for KSYN FitConnect. The network architecture implements a hierarchical **Hub-and-Spoke Enterprise Wide Area Network (WAN)** that interconnects corporate headquarters with the geographically distributed franchise branches across Metro Manila and expanding provincial hubs.

```
                                [ KSYN Central Cloud Host ]
                                (Server-PT SERVER / Switch14)
                                             │
                                             ▼
                                     [ Cisco 2811 R0 ]
                                     (HQ Cloud Gateway)
                                             │
                                             ▼
                         ┌───────────────────────────────────────┐
                         │               AWS CLOUD               │
                         │    (Central Cloud Network Backbone)   │
                         └───────────────────┬───────────────────┘
                                             │
            ┌────────────────────────────────┼────────────────────────────────┐
            │                                │                                │
            ▼                                ▼                                ▼
    [ Cisco 2811 R1 ]               [ Cisco 2811 Router0 ]            [ Cisco 2811 R2 ]
 (Branch Gateway - Zone A)       (Branch Gateway - Zone B)        (Branch Gateway - Zone C)
            │                                │                                │
            ▼                                ▼                                ▼
   [ 2960-24TT Switch0 ]           [ 2960-24TT Switch16/17 ]         [ 2960-24TT Switch1 ]
            │                                │                                │
   ┌────────┴────────┐              ┌────────┴────────┐              ┌────────┴────────┐
   ▼        ▼        ▼              ▼                 ▼              ▼        ▼        ▼
Switch4  Switch3  Switch2       POS / PC          Access Point    Switch10 Switch9  Switch8
(Front)  (Staff)  (WiFi)         Laptops          Cisco IP Phone  (Front)  (Staff)  (WiFi)
```

The network design directly supports the system's operational objectives established in Chapters I and III:
1. **Centralized Multi-Tenant Cloud Data Management:** Providing seamless connectivity between edge terminals and the centralized application backend and PostgreSQL database.
2. **Strict Multi-Tenant Branch Autonomy:** Isolating local branch traffic while routing authorized transactions to the central cloud.
3. **Triple-Play Service Delivery:** Integrating transactional data (POS cash registers and admin terminals), wireless mobile connectivity (member optical dynamic QR pass generation), and voice telephony (inter-branch VoIP communications).

---

## 2. Infrastructure Tiers Breakdown

### 2.1 Central Cloud Backbone & Hosting Tier (`AWS Cloud`)
* **Core Network Component:** Modeled in Cisco Packet Tracer as `Cloud-PT-Empty` with the operational label **`AWS Cloud`**.
* **Role & Function:** Serves as the high-availability cloud backbone interconnecting all franchise nodes.
* **Cloud Platform Alignment:** The central cloud infrastructure hosts the KSYN FitConnect unified application engine (React 18 production client, Node.js Express REST API, and WebSocket real-time gateway) alongside the primary multi-tenant PostgreSQL database. While deployed in production environments on containerized cloud infrastructure (such as Render or AWS Cloud in the Singapore `ap-southeast-1` region), the network topology utilizes the AWS Cloud backbone to provide carrier-grade routing, elastic bandwidth, and low-latency transit to Philippine telecommunications carriers (PLDT, Globe, Converge).
* **Headquarters Gateway (`Cisco 2811 R0` & `Switch14`):**
  - Connects the central cloud server (`Server-PT SERVER`) directly to the cloud backbone.
  - Processes incoming RESTful API requests, cryptographic optical pass verifications, and real-time WebSocket check-in broadcasts.
  - Executes the automated 7.5% corporate royalty computation engine and Philippine Bureau of Internal Revenue (BIR) Form 2307 withholding tax schedules.

---

### 2.2 Regional Branch Gateways & Distribution Tiers
The modeled franchise network is organized into three primary operational regional routing zones:

#### A. Regional Branch Cluster A (`Cisco 2811 R1` & `Switch0`)
* **Coverage:** Represents modeled metro franchise facilities (e.g., BGC Flagship BGC-01, Alabang ALB-06, and Kapitolyo Pasig KAP-04).
* **Distribution Architecture:** The edge router `R1` interfaces with distribution switch `Switch0`, which branches into dedicated access switches (`Switch4`, `Switch3`, and `Switch2`).
* **Hardware Endpoints:**
  - **Front-Desk POS Terminals (`PC-PT`):** Dedicated workstations executing cashiering, membership registration, locker custody assignments, and blind drawer shift closings.
  - **Cisco 7960 IP Phones:** Hardware IP telephony handsets providing dedicated voice communication between the branch front desk, the general manager's office, and corporate headquarters.
  - **Wireless Access Points (`AccessPoint-PT`):** High-throughput wireless APs providing continuous Wi-Fi coverage across the gym floor, enabling athletes and personal trainers to access mobile web portals.

#### B. Regional Branch Cluster B (`Cisco 2811 Router0` & `Switch16 / Switch17`)
* **Coverage:** Represents modeled central facilities (e.g., Del Monte Quezon City DLM-05 and Fairview Pontiac FRV-03).
* **Distribution Architecture:** The router `Router0` terminates WAN traffic and distributes local connections through access switches `Switch16` and `Switch17`.
* **Hardware Endpoints:**
  - Branch administrative workstations (`PC-PT`, `Laptop-PT`) used by the Branch Administrator (General Manager) to audit shift variances, manage staff credentials, and approve two-stage inter-branch member transfer requests.
  - Cisco 7960 IP Phones for branch manager hotline inquiries.
  - Wireless Access Point (`AccessPoint-PT`) facilitating member check-in queueing.

#### C. Regional Branch Cluster C (`Cisco 2811 R2` & `Switch1`)
* **Coverage:** Represents modeled business hub and regional facilities (e.g., Alphaland Makati MKT-02, Katipunan Regis Center KTP-07, and expanding commercial hubs).
* **Distribution Architecture:** Edge router `R2` connects through distribution switch `Switch1` to dedicated floor switches (`Switch10`, `Switch9`, and `Switch8`).
* **Hardware Endpoints:**
  - Front-counter optical check-in scanners and cashier workstations (`PC-PT`).
  - Cisco 7960 IP Phones and wireless access points delivering full gym-floor coverage.

---

## 3. Operational Alignment with Chapters I, II, and III

### 3.1 Software-Delimited Access Control & Optical Scanners
As established in Chapter I (Scope and Limitations), physical electromechanical turnstiles and microcontroller relays (Arduino/ESP32) are explicitly delimited in favor of enterprise responsive web applications and front-desk optical scanners:
* In the topology, the front-desk workstations (`PC-PT`) operate high-resolution optical web camera scanners.
* Gym members connect their smartphones to the local branch **`AccessPoint-PT`** to retrieve their 60-second rotating HMAC-SHA256 dynamic QR code pass.
* The optical camera on the front-desk workstation captures the token and dispatches an authenticated verification payload to `Server-PT SERVER` across the AWS Cloud backbone.
* Verification occurs in under 20 milliseconds, returning an immediate admission status to the front-desk display.

### 3.2 Data Isolation & Row-Level Security (RLS) over Shared WAN
Although all branches transmit operational traffic across the shared AWS Cloud backbone to a unified database server, tenant data isolation is mathematically enforced at the database tier:
* The network routes transactions securely, where the Express middleware injects `SET LOCAL app.current_tenant_id = [branch_id]`.
* Even though workstations under `R1`, `Router0`, and `R2` reach the same central server, PostgreSQL Row-Level Security ensures that Branch A's queries return 0 rows when attempting to inspect Branch B's records, fully resolving Broken Object-Level Authorization (BOLA) and Insecure Direct Object References (IDOR).

### 3.3 Cashier Governance & Shift Integrity (Blind Close)
* Workstations at `Switch4`, `Switch16`, and `Switch10` run front-desk POS sessions.
* Opening cash floats, day pass sales (₱450), and retail receipts increment system expected cash counters.
* At shift conclusion, the cashier enters the counted physical cash blind; the server computes any variance without disclosing expected balances beforehand, enforcing strict fiscal accountability.

### 3.4 Regulatory Compliance (RA 10173 - Data Privacy Act of 2012)
* Member personal records transmitted between edge routers and the central server are encrypted in transit using Transport Layer Security (TLS 1.3).
* Front-desk client screens render masked Personally Identifiable Information (PII) to prevent shoulder-surfing by visitors standing in line near the reception counter.

---

## 4. Summary Table: Network Device Inventory

| Device Model | Role in Topology | Deployed Location | Primary Function |
| :--- | :--- | :--- | :--- |
| **`Cloud-PT-Empty` (AWS Cloud)** | Central WAN Cloud Backbone | Central Backbone | Interconnects Corporate HQ with all regional branch routers across a high-speed cloud WAN. |
| **`Cisco 2811 (R0)`** | Cloud Gateway Router | Corporate Headquarters / Cloud Host | Routes incoming multi-branch traffic to the central application and database server tier. |
| **`Server-PT (SERVER)`** | Enterprise Application & Database Server | Cloud Datacenter / HQ | Hosts the KSYN FitConnect Node.js/PHP backend, PostgreSQL RLS database, and WebSocket services. |
| **`Cisco 2811 (R1, Router0, R2)`** | Regional Branch Edge Gateways | Regional Franchise Branch Nodes | Terminates WAN links and manages local branch subnet routing and traffic forwarding. |
| **`Cisco 2960-24TT Switches`** | Distribution & Access Switches | Branch Facilities (Front Desk, Admin, Gym Floor) | Provides high-density FastEthernet and Gigabit Ethernet connectivity for POS, PC, and AP nodes. |
| **`AccessPoint-PT`** | Wireless Access Points | Gym Floor & Reception Lobby | Provides Wi-Fi connectivity for member mobile smartphones generating 60-second dynamic QR passes. |
| **`Cisco 7960 IP Phones`** | Enterprise VoIP Telephony | Front Counter & General Manager Offices | Facilitates high-definition operational voice communication across branches and corporate HQ. |
| **`PC-PT & Laptop-PT`** | Client Workstations & POS Terminals | Front-Desk Counters & Manager Desks | Runs the KSYN FitConnect responsive web portal, optical camera scanners, and cashier POS registers. |
