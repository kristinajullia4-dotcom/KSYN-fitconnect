<?php

namespace Ksyn\Routes;

use Slim\App;
use Slim\Routing\RouteCollectorProxy;
use Ksyn\Middleware\AuthGuard;
use Ksyn\Middleware\RbacGuard;
use Ksyn\Controllers\AuthController;
use Ksyn\Controllers\BranchController;
use Ksyn\Controllers\MemberController;
use Ksyn\Controllers\QrController;
use Ksyn\Controllers\InventoryController;
use Ksyn\Controllers\FinanceController;
use Ksyn\Controllers\PosShiftController;
use Ksyn\Controllers\AuditController;
use Ksyn\Controllers\SuperAdminController;
use Ksyn\Controllers\BranchAdminController;
use Ksyn\Controllers\FreePassController;
use Ksyn\Controllers\CoachController;
use Ksyn\Controllers\MaintenanceController;
use Ksyn\Controllers\NotificationController;
use Ksyn\Controllers\PayrollController;
use Ksyn\Controllers\ClassBookingController;
use Ksyn\Controllers\PaymentController;
use Ksyn\Controllers\XenditController;

class ApiRoutes
{
    public static function register(App $app): void
    {
        $app->group('/api', function (RouteCollectorProxy $group) {

            // Global Webhook & Franchise endpoints
            $group->post('/webhooks/xendit', [XenditController::class, 'handleWebhook']);
            $group->post('/franchise-inquiry', [SuperAdminController::class, 'createFranchiseInquiry']);

            // 1. Auth Routes
            $group->group('/auth', function (RouteCollectorProxy $auth) {
                $auth->post('/login', [AuthController::class, 'login']);
                $auth->post('/google', [AuthController::class, 'googleLogin']);
                $auth->post('/google/complete', [AuthController::class, 'completeGoogleRegistration']);
                $auth->get('/profile', [AuthController::class, 'getProfile'])->add(new AuthGuard());
                $auth->post('/logout', [AuthController::class, 'logout']);
                $auth->post('/refresh', [AuthController::class, 'refreshToken']);
                $auth->post('/demo-switch-role', [AuthController::class, 'demoSwitchRole']);
                $auth->post('/register-user', [AuthController::class, 'registerUser']);
                $auth->post('/send-registration-otp', [AuthController::class, 'sendRegistrationOtp']);
                $auth->post('/register', [AuthController::class, 'register']);
                $auth->post('/forgot-password', [AuthController::class, 'forgotPassword']);
                $auth->post('/reset-password', [AuthController::class, 'resetPassword']);
                $auth->post('/verify-mfa', [AuthController::class, 'verifyMfa']);
            });

            // 2. Branch Routes
            $group->group('/branches', function (RouteCollectorProxy $branches) {
                $branches->get('/public', [BranchController::class, 'getPublicBranches']);
                $branches->get('', [BranchController::class, 'getAllBranches'])->add(new AuthGuard());
                $branches->get('/{id}', [BranchController::class, 'getBranchById'])->add(new AuthGuard());
                $branches->put('/{id}/royalty-rate', [BranchController::class, 'updateRoyaltyRate'])
                    ->add(RbacGuard::roles('super_admin'))
                    ->add(new AuthGuard());
            });

            // 3. Member Routes (Mounted on /members and /member)
            $registerMemberRoutes = function (RouteCollectorProxy $members) {
                $members->get('', [MemberController::class, 'getMembers'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin', 'staff', 'front_desk', 'receptionist', 'cashier', 'employee'))
                    ->add(new AuthGuard());
                $members->get('/dashboard/stats', [MemberController::class, 'getDashboardStats'])->add(new AuthGuard());
                $members->get('/floor-density', [MemberController::class, 'getFloorDensity'])->add(new AuthGuard());
                $members->get('/branch/density', [MemberController::class, 'getFloorDensity'])->add(new AuthGuard());
                $members->get('/progress', [MemberController::class, 'getProgress'])->add(new AuthGuard());
                $members->post('/progress', [MemberController::class, 'logProgress'])->add(new AuthGuard());
                $members->get('/strength-prs', [MemberController::class, 'getStrengthPRs'])->add(new AuthGuard());
                $members->post('/strength-prs', [MemberController::class, 'logStrengthPR'])->add(new AuthGuard());
                $members->get('/available-coaches', [MemberController::class, 'getAvailableCoaches'])->add(new AuthGuard());
                $members->post('/enroll-coach', [MemberController::class, 'enrollCoach'])->add(new AuthGuard());
                $members->get('/messages', [MemberController::class, 'getMemberMessages'])->add(new AuthGuard());
                $members->post('/messages', [MemberController::class, 'sendMemberMessage'])->add(new AuthGuard());
                $members->get('/workout-plans', [MemberController::class, 'getMemberWorkoutPlans'])->add(new AuthGuard());
                $members->post('/workout-plans/{planId}/complete-exercise', [MemberController::class, 'toggleExerciseComplete'])->add(new AuthGuard());
                $members->post('/subscription/toggle-auto-renew', [MemberController::class, 'toggleAutoRenew'])->add(new AuthGuard());
                $members->post('/renew', [MemberController::class, 'renewSubscription'])->add(new AuthGuard());
                $members->post('/{id}/renew', [MemberController::class, 'renewSubscription'])->add(new AuthGuard());
                $members->patch('/{id}/status', [MemberController::class, 'updateMemberStatus'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $members->get('/{id}/progress', [MemberController::class, 'getProgress'])->add(new AuthGuard());
                $members->get('/{id}/prs', [MemberController::class, 'getStrengthPRs'])->add(new AuthGuard());
                $members->post('/{id}/prs', [MemberController::class, 'logStrengthPR'])->add(new AuthGuard());
                $members->get('/{id}', [MemberController::class, 'getMemberById'])->add(new AuthGuard());
            };
            $group->group('/members', $registerMemberRoutes);
            $group->group('/member', $registerMemberRoutes);

            // 4. QR & Turnstile Routes (Mounted on /qr and /turnstile)
            $registerQrRoutes = function (RouteCollectorProxy $qr) {
                $qr->map(['GET', 'POST'], '/generate-pass', [QrController::class, 'generatePass'])->add(new AuthGuard());
                $qr->map(['GET', 'POST'], '/verify-pass', [QrController::class, 'verifyPass']);
                $qr->map(['GET', 'POST'], '/scan', [QrController::class, 'verifyPass']);
                $qr->map(['GET', 'POST'], '/verify', [QrController::class, 'verifyPass']);
                $qr->get('/attendance-logs', [QrController::class, 'getAttendanceLogs'])->add(new AuthGuard());
                $qr->get('/telemetry', [QrController::class, 'getTelemetry']);
                $qr->get('/rfid-registry', [QrController::class, 'getRfidRegistry'])->add(new AuthGuard());
                $qr->get('/hardware-status', [QrController::class, 'getHardwareStatus'])->add(new AuthGuard());
                $qr->post('/manual-pulse', [QrController::class, 'triggerManualPulse'])->add(new AuthGuard());
            };
            $group->group('/qr', $registerQrRoutes);
            $group->group('/turnstile', $registerQrRoutes);

            // 5. Inventory Routes
            $group->group('/inventory', function (RouteCollectorProxy $inv) {
                $inv->get('', [InventoryController::class, 'getAllItems'])->add(new AuthGuard());
                $inv->post('', [InventoryController::class, 'createItem'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $inv->put('/{id}', [InventoryController::class, 'updateItem'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $inv->post('/reorder', [InventoryController::class, 'reorderStock'])->add(new AuthGuard());
                $inv->get('/procurement-feed', [InventoryController::class, 'getProcurementFeed'])->add(new AuthGuard());

                // Maintenance Sub-routes
                $inv->group('/maintenance', function (RouteCollectorProxy $maint) {
                    $maint->get('/equipment', [MaintenanceController::class, 'getEquipmentRegistry'])->add(new AuthGuard());
                    $maint->get('/schedules', [MaintenanceController::class, 'getEquipmentRegistry'])->add(new AuthGuard());
                    $maint->post('/equipment', [MaintenanceController::class, 'createWorkOrder'])
                        ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                        ->add(new AuthGuard());
                    $maint->get('/work-orders', [MaintenanceController::class, 'getWorkOrders'])->add(new AuthGuard());
                    $maint->post('/work-orders', [MaintenanceController::class, 'createWorkOrder'])->add(new AuthGuard());
                    $maint->patch('/work-orders/{id}/complete', [MaintenanceController::class, 'completeWorkOrder'])->add(new AuthGuard());
                    $maint->patch('/work-orders/{id}', [MaintenanceController::class, 'completeWorkOrder'])->add(new AuthGuard());
                    $maint->post('/telemetry', [MaintenanceController::class, 'recordIoTTelemetry'])->add(new AuthGuard());
                    $maint->post('/iot-telemetry', [MaintenanceController::class, 'recordIoTTelemetry']);
                });
            });

            // 6. Finance Routes
            $group->group('/finance', function (RouteCollectorProxy $fin) {
                $fin->get('/sales', [FinanceController::class, 'getSalesLedger'])->add(new AuthGuard());
                $fin->get('/ledger', [FinanceController::class, 'getSalesLedger'])->add(new AuthGuard());
                $fin->post('/sale', [FinanceController::class, 'recordSale'])->add(new AuthGuard());
                $fin->post('/record-sale', [FinanceController::class, 'recordSale'])->add(new AuthGuard());
                $fin->post('/checkout', [FinanceController::class, 'recordSale'])->add(new AuthGuard());
                $fin->get('/royalties', [FinanceController::class, 'getRoyalties'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin', 'branch_owner', 'investor'))
                    ->add(new AuthGuard());
                $fin->get('/waivers', [FinanceController::class, 'getWaivers'])->add(new AuthGuard());
                $fin->post('/waiver', [FinanceController::class, 'signWaiver'])->add(new AuthGuard());
                $fin->post('/waivers/sign', [FinanceController::class, 'signWaiver'])->add(new AuthGuard());
                $fin->get('/remittances', [FinanceController::class, 'getRemittances'])->add(new AuthGuard());
                $fin->post('/remittances', [FinanceController::class, 'settleRemittance'])->add(new AuthGuard());
                $fin->post('/remit-royalty', [FinanceController::class, 'settleRemittance'])->add(new AuthGuard());
                $fin->get('/capex-assets', [FinanceController::class, 'getCapexAssets'])->add(new AuthGuard());
                $fin->post('/cash-drawer/blind-reconciliation', [FinanceController::class, 'reconcileBlindCash'])->add(new AuthGuard());
                $fin->get('/bir-2307/{remittanceId}', [FinanceController::class, 'getBir2307Certificate'])->add(new AuthGuard());

                // Payroll Sub-routes
                $fin->group('/payroll', function (RouteCollectorProxy $payroll) {
                    $payroll->post('/batch-payout', [PayrollController::class, 'generateBatchPayroll'])
                        ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                        ->add(new AuthGuard());
                    $payroll->get('/payslips', [PayrollController::class, 'getPayslips'])
                        ->add(RbacGuard::roles('super_admin', 'branch_admin', 'coach', 'trainer'))
                        ->add(new AuthGuard());
                    $payroll->get('/payslips/{id}', [PayrollController::class, 'getPayslipById'])
                        ->add(RbacGuard::roles('super_admin', 'branch_admin', 'coach', 'trainer'))
                        ->add(new AuthGuard());
                    $payroll->get('/export-bank-batch', [PayrollController::class, 'exportBankBatchCsv'])
                        ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                        ->add(new AuthGuard());
                });
            });

            // 7. POS Shift Routes
            $group->group('/pos', function (RouteCollectorProxy $pos) {
                $pos->get('/products', [PosShiftController::class, 'getPosProducts'])->add(new AuthGuard());
                $pos->post('/shift/open', [PosShiftController::class, 'openShift'])->add(new AuthGuard());
                $pos->get('/shift/current', [PosShiftController::class, 'getCurrentShift'])->add(new AuthGuard());
                $pos->post('/shift/close', [PosShiftController::class, 'closeShift'])->add(new AuthGuard());
                $pos->post('/checkout', [PosShiftController::class, 'checkoutPosSale'])->add(new AuthGuard());
            });

            // 8. Audit Routes
            $group->group('/audit', function (RouteCollectorProxy $audit) {
                $audit->get('', [AuditController::class, 'getAuditTrail'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $audit->get('/verify-chain', [AuditController::class, 'verifyAuditChain'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
            });

            // 9. Super Admin Routes (Mounted on /super-admin and /admin)
            $registerSuperAdminRoutes = function (RouteCollectorProxy $sa) {
                $sa->get('/overview', [SuperAdminController::class, 'getStats'])
                    ->add(RbacGuard::roles('super_admin'))
                    ->add(new AuthGuard());
                $sa->get('/stats', [SuperAdminController::class, 'getStats'])
                    ->add(RbacGuard::roles('super_admin'))
                    ->add(new AuthGuard());
                $sa->get('/admins', [SuperAdminController::class, 'getAdmins'])
                    ->add(RbacGuard::roles('super_admin'))
                    ->add(new AuthGuard());
                $sa->post('/admins', [SuperAdminController::class, 'createAdmin'])
                    ->add(RbacGuard::roles('super_admin'))
                    ->add(new AuthGuard());
                $sa->put('/admins/{id}/status', [SuperAdminController::class, 'updateAdminStatus'])
                    ->add(RbacGuard::roles('super_admin'))
                    ->add(new AuthGuard());
                $sa->get('/franchise-inquiries', [SuperAdminController::class, 'getFranchiseInquiries'])
                    ->add(RbacGuard::roles('super_admin'))
                    ->add(new AuthGuard());
                $sa->get('/franchise-applications', [SuperAdminController::class, 'getFranchiseApplications'])
                    ->add(RbacGuard::roles('super_admin'))
                    ->add(new AuthGuard());
                $sa->patch('/franchise-inquiries/{id}/status', [SuperAdminController::class, 'updateFranchiseInquiryStatus'])
                    ->add(RbacGuard::roles('super_admin'))
                    ->add(new AuthGuard());
                $sa->patch('/franchise-applications/{id}/status', [SuperAdminController::class, 'updateFranchiseApplicationStatus'])
                    ->add(RbacGuard::roles('super_admin'))
                    ->add(new AuthGuard());
                $sa->post('/branches', [SuperAdminController::class, 'registerBranch'])
                    ->add(RbacGuard::roles('super_admin'))
                    ->add(new AuthGuard());
                $sa->get('/coaches/all', [SuperAdminController::class, 'getAllCoaches'])
                    ->add(RbacGuard::roles('super_admin'))
                    ->add(new AuthGuard());
                $sa->get('/analytics/multi-tenant', [SuperAdminController::class, 'getMultiTenantAnalytics'])
                    ->add(RbacGuard::roles('super_admin'))
                    ->add(new AuthGuard());
                $sa->get('/promos', [SuperAdminController::class, 'getPromos'])
                    ->add(RbacGuard::roles('super_admin'))
                    ->add(new AuthGuard());
                $sa->post('/promos', [SuperAdminController::class, 'createPromo'])
                    ->add(RbacGuard::roles('super_admin'))
                    ->add(new AuthGuard());
                $sa->patch('/promos/{id}/toggle', [SuperAdminController::class, 'togglePromo'])
                    ->add(RbacGuard::roles('super_admin'))
                    ->add(new AuthGuard());
                $sa->delete('/promos/{id}', [SuperAdminController::class, 'deletePromo'])
                    ->add(RbacGuard::roles('super_admin'))
                    ->add(new AuthGuard());
                $sa->get('/broadcasts', [SuperAdminController::class, 'getBroadcasts'])
                    ->add(RbacGuard::roles('super_admin'))
                    ->add(new AuthGuard());
                $sa->post('/broadcasts', [SuperAdminController::class, 'createBroadcast'])
                    ->add(RbacGuard::roles('super_admin'))
                    ->add(new AuthGuard());
            };
            $group->group('/super-admin', $registerSuperAdminRoutes);
            $group->group('/admin', $registerSuperAdminRoutes);

            // 10. Branch Admin Routes
            $group->group('/branch-admin', function (RouteCollectorProxy $ba) {
                $ba->get('/staff', [BranchAdminController::class, 'getStaff'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin', 'branch_owner'))
                    ->add(new AuthGuard());
                $ba->post('/staff', [BranchAdminController::class, 'createStaff'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $ba->put('/staff/{id}/status', [BranchAdminController::class, 'updateStaffStatus'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $ba->patch('/staff/{id}/toggle', [BranchAdminController::class, 'toggleStaffStatus'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $ba->get('/members', [BranchAdminController::class, 'getMembers'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin', 'branch_owner'))
                    ->add(new AuthGuard());
                $ba->post('/check-in', [BranchAdminController::class, 'checkInMember'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin', 'employee', 'staff'))
                    ->add(new AuthGuard());
                $ba->get('/cross-branch-visits', [BranchAdminController::class, 'getCrossBranchVisits'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin', 'branch_owner'))
                    ->add(new AuthGuard());
                $ba->post('/inventory/reorder-request', [InventoryController::class, 'reorderStock'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $ba->get('/inventory/reorder-requests', [InventoryController::class, 'getProcurementFeed'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin', 'branch_owner'))
                    ->add(new AuthGuard());
                $ba->get('/free-pass-applicants', [FreePassController::class, 'getEntries'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $ba->get('/free-pass/applicants', [FreePassController::class, 'getEntries'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $ba->post('/free-pass/award/{id}', [FreePassController::class, 'awardPass'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $ba->post('/free-pass/draw-winner', [FreePassController::class, 'drawWinner'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $ba->get('/ledger', [BranchAdminController::class, 'getLedger'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin', 'branch_owner'))
                    ->add(new AuthGuard());
                $ba->get('/incidents', [BranchAdminController::class, 'getIncidents'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin', 'branch_owner'))
                    ->add(new AuthGuard());
                $ba->post('/incidents', [BranchAdminController::class, 'createIncident'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $ba->patch('/incidents/{id}/status', [BranchAdminController::class, 'updateIncidentStatus'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $ba->get('/inventory/burn-rate', [BranchAdminController::class, 'getInventoryBurnRate'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin', 'branch_owner'))
                    ->add(new AuthGuard());
                $ba->post('/pos/verify-supervisor-pin', [BranchAdminController::class, 'verifySupervisorPin'])
                    ->add(new AuthGuard());
                $ba->get('/shifts', [BranchAdminController::class, 'getShifts'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin', 'branch_owner'))
                    ->add(new AuthGuard());
                $ba->post('/shifts', [BranchAdminController::class, 'createShift'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $ba->delete('/shifts/{id}', [BranchAdminController::class, 'deleteShift'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $ba->get('/timeclock/logs', [BranchAdminController::class, 'getTimeclockLogs'])
                    ->add(new AuthGuard());
                $ba->post('/timeclock/punch', [BranchAdminController::class, 'punchTimeclock'])
                    ->add(new AuthGuard());
                $ba->get('/lockers/vip', [BranchAdminController::class, 'getVipLockers'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin', 'branch_owner'))
                    ->add(new AuthGuard());
                $ba->post('/lockers/vip', [BranchAdminController::class, 'assignVipLocker'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $ba->post('/lockers/vip/{id}/release', [BranchAdminController::class, 'releaseVipLocker'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $ba->get('/expenses', [BranchAdminController::class, 'getExpenses'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin', 'branch_owner'))
                    ->add(new AuthGuard());
                $ba->post('/expenses', [BranchAdminController::class, 'recordExpense'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $ba->get('/members/churn-risk', [BranchAdminController::class, 'getChurnRiskMembers'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin', 'branch_owner'))
                    ->add(new AuthGuard());
                $ba->post('/members/re-engage/{id}', [BranchAdminController::class, 'reEngageMember'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $ba->get('/announcements', [BranchAdminController::class, 'getBranchAnnouncements'])
                    ->add(new AuthGuard());
                $ba->post('/announcements', [BranchAdminController::class, 'createBranchAnnouncement'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $ba->delete('/announcements/{id}', [BranchAdminController::class, 'deleteBranchAnnouncement'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
            });

            // 11. Free Pass Routes
            $group->group('/free-pass', function (RouteCollectorProxy $fp) {
                $fp->post('/submit', [FreePassController::class, 'submitFreePass']);
                $fp->get('/entries', [FreePassController::class, 'getEntries'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $fp->post('/draw-winner', [FreePassController::class, 'drawWinner'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $fp->post('/award-pass', [FreePassController::class, 'awardPass'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
            });

            // 12. Coach Routes
            $group->group('/coach', function (RouteCollectorProxy $coach) {
                $coach->get('/clients', [CoachController::class, 'getClients'])
                    ->add(RbacGuard::roles('coach', 'trainer', 'super_admin', 'branch_admin', 'front_desk', 'employee', 'staff'))
                    ->add(new AuthGuard());
                $coach->post('/clients/{clientId}/renew-package', [CoachController::class, 'renewClientPackage'])
                    ->add(RbacGuard::roles('coach', 'trainer', 'super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $coach->post('/sessions', [CoachController::class, 'logSession'])
                    ->add(RbacGuard::roles('coach', 'trainer', 'super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $coach->get('/sessions', [CoachController::class, 'getSessions'])
                    ->add(RbacGuard::roles('coach', 'trainer', 'super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $coach->post('/log-session', [CoachController::class, 'logSession'])
                    ->add(RbacGuard::roles('coach', 'trainer', 'super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $coach->put('/clients/{clientId}/metrics', [CoachController::class, 'updateClientMetrics'])
                    ->add(RbacGuard::roles('coach', 'trainer', 'super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $coach->get('/commissions', [CoachController::class, 'getCommissions'])
                    ->add(RbacGuard::roles('coach', 'trainer', 'super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $coach->get('/classes', [CoachController::class, 'getAssignedClasses'])
                    ->add(RbacGuard::roles('coach', 'trainer', 'super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $coach->post('/classes/check-in', [CoachController::class, 'checkInClassAttendee'])
                    ->add(RbacGuard::roles('coach', 'trainer', 'super_admin', 'branch_admin', 'employee', 'staff'))
                    ->add(new AuthGuard());
                $coach->post('/classes/{classId}/check-in', [CoachController::class, 'checkInClassAttendee'])
                    ->add(RbacGuard::roles('coach', 'trainer', 'super_admin', 'branch_admin', 'employee', 'staff'))
                    ->add(new AuthGuard());
                $coach->get('/messages[/{clientId}]', [CoachController::class, 'getCoachMessages'])
                    ->add(RbacGuard::roles('coach', 'trainer', 'super_admin', 'branch_admin', 'member'))
                    ->add(new AuthGuard());
                $coach->post('/messages', [CoachController::class, 'sendCoachMessage'])
                    ->add(RbacGuard::roles('coach', 'trainer', 'super_admin', 'branch_admin', 'member'))
                    ->add(new AuthGuard());
                $coach->get('/workout-plans', [CoachController::class, 'getWorkoutPlans'])
                    ->add(RbacGuard::roles('coach', 'trainer', 'super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $coach->post('/workout-plans', [CoachController::class, 'createWorkoutPlan'])
                    ->add(RbacGuard::roles('coach', 'trainer', 'super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $coach->delete('/workout-plans/{planId}', [CoachController::class, 'deleteWorkoutPlan'])
                    ->add(RbacGuard::roles('coach', 'trainer', 'super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $coach->post('/classes/{classId}/scan-pass', [CoachController::class, 'scanClassQrPass'])
                    ->add(RbacGuard::roles('coach', 'trainer', 'super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $coach->get('/clients/{clientId}/strength', [CoachController::class, 'getClientStrength'])
                    ->add(RbacGuard::roles('coach', 'trainer', 'super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $coach->post('/clients/{clientId}/strength', [CoachController::class, 'recordClientStrength'])
                    ->add(RbacGuard::roles('coach', 'trainer', 'super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $coach->get('/clients/{clientId}/nutrition', [CoachController::class, 'getClientNutrition'])
                    ->add(RbacGuard::roles('coach', 'trainer', 'super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $coach->post('/clients/{clientId}/nutrition', [CoachController::class, 'setClientNutrition'])
                    ->add(RbacGuard::roles('coach', 'trainer', 'super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $coach->get('/commission-slips', [CoachController::class, 'getItemizedCommissionSlips'])
                    ->add(RbacGuard::roles('coach', 'trainer', 'super_admin', 'branch_admin'))
                    ->add(new AuthGuard());

                // Coach Payroll Sub-routes
                $coach->group('/payroll', function (RouteCollectorProxy $payroll) {
                    $payroll->post('/batch-payout', [PayrollController::class, 'generateBatchPayroll'])
                        ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                        ->add(new AuthGuard());
                    $payroll->get('/payslips', [PayrollController::class, 'getPayslips'])
                        ->add(RbacGuard::roles('super_admin', 'branch_admin', 'coach', 'trainer'))
                        ->add(new AuthGuard());
                    $payroll->get('/payslips/{id}', [PayrollController::class, 'getPayslipById'])
                        ->add(RbacGuard::roles('super_admin', 'branch_admin', 'coach', 'trainer'))
                        ->add(new AuthGuard());
                    $payroll->get('/export-bank-batch', [PayrollController::class, 'exportBankBatchCsv'])
                        ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                        ->add(new AuthGuard());
                });
            });

            // 13. Payments & Xendit Routes
            $group->group('/payments', function (RouteCollectorProxy $pay) {
                // Card & E-Wallet public onboarding
                $pay->post('/tokenize-card', [PaymentController::class, 'tokenizeCard']);
                $pay->post('/verify-3ds', [PaymentController::class, 'verify3DSecure']);
                $pay->post('/create-billing-agreement', [PaymentController::class, 'createBillingAgreement']);
                $pay->post('/generate-qr-ph', [PaymentController::class, 'generateDynamicQrPh']);
                $pay->post('/webhook', [PaymentController::class, 'handlePaymentWebhook']);
                $pay->post('/onboard-member', [PaymentController::class, 'onboardMember']);
                $pay->post('/settle-member-payment', [PaymentController::class, 'settleMemberPayment'])->add(new AuthGuard());
                $pay->post('/trigger-recurring-billing', [PaymentController::class, 'triggerRecurringBilling'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $pay->get('/methods/{userId}', [PaymentController::class, 'getPaymentMethods'])->add(new AuthGuard());
                $pay->delete('/methods/{methodId}', [PaymentController::class, 'deletePaymentMethod'])->add(new AuthGuard());
                $pay->get('/invoices', [PaymentController::class, 'getInvoices'])->add(new AuthGuard());

                // Xendit Sub-routes
                $pay->group('/xendit', function (RouteCollectorProxy $xnd) {
                    $xnd->get('/config', [XenditController::class, 'getConfig']);
                    $xnd->post('/create-invoice', [XenditController::class, 'createInvoice']);
                    $xnd->post('/create-qr', [XenditController::class, 'createDynamicQr']);
                    $xnd->post('/charge-card', [XenditController::class, 'chargeCard'])->add(new AuthGuard());
                    $xnd->post('/webhook', [XenditController::class, 'handleWebhook']);
                    $xnd->post('/trigger-recurring', [XenditController::class, 'triggerRecurringBilling'])
                        ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                        ->add(new AuthGuard());
                    $xnd->get('/qr-status/{id}', [XenditController::class, 'getQrStatus']);
                    $xnd->post('/simulate-qr-paid/{id}', [XenditController::class, 'simulateQrPaid']);
                });
            });

            // 14. Notifications Routes
            $group->group('/notifications', function (RouteCollectorProxy $notif) {
                $notif->get('/sms/logs', [NotificationController::class, 'getSmsLogs'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
                $notif->post('/sms/send', [NotificationController::class, 'sendAdministrativeSms'])
                    ->add(RbacGuard::roles('super_admin', 'branch_admin'))
                    ->add(new AuthGuard());
            });

            // 15. Classes Routes
            $group->group('/classes', function (RouteCollectorProxy $cls) {
                $cls->get('', [ClassBookingController::class, 'getAllClasses'])->add(new AuthGuard());
                $cls->get('/my-bookings', [ClassBookingController::class, 'getMyBookings'])->add(new AuthGuard());
                $cls->get('/{classId}/roster', [ClassBookingController::class, 'getClassRoster'])->add(new AuthGuard());
                $cls->post('/{classId}/book', [ClassBookingController::class, 'bookClass'])->add(new AuthGuard());
                $cls->post('/{classId}/cancel', [ClassBookingController::class, 'cancelBooking'])->add(new AuthGuard());
                $cls->post('/{classId}/walk-in', [ClassBookingController::class, 'registerWalkIn'])->add(new AuthGuard());
            });

        });
    }
}
