import { useState } from "react";
import { CheckCircle, Eye, Info, Shield, Trash2, X } from "lucide-react";

function IdPhoto({ label, src }) {
  const [expanded, setExpanded] = useState(false);

  if (!src) {
    return (
      <div className="aspect-[3/2] rounded-xl border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center gap-1 text-slate-400">
        <span className="text-[10px] font-bold uppercase font-mono">{label}</span>
        <span className="text-[10px]">No photo submitted</span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="group relative w-full aspect-[3/2] rounded-xl border border-slate-200 overflow-hidden bg-slate-100 cursor-pointer text-left"
        title={`View ${label}`}
      >
        <img src={src} alt={label} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/35 transition-colors flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-white text-[10px] font-bold uppercase tracking-wider">
            <Eye size={12} /> Enlarge
          </span>
        </div>
        <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-slate-900/75 text-white text-[9px] font-bold uppercase font-mono">
          {label}
        </span>
      </button>

      {expanded && (
        <div
          className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-slate-950/85"
          onClick={() => setExpanded(false)}
        >
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white cursor-pointer"
          >
            <X size={22} />
          </button>
          <img
            src={src}
            alt={label}
            className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

/**
 * Shared admin modal to review rescuer personal details + submitted ID photos.
 * Accepts either API snake_case rows or dashboard-mapped camelCase objects.
 */
export default function RescuerReviewModal({
  rescuer,
  onClose,
  onApprove,
  onReject,
}) {
  if (!rescuer) return null;

  const dbId = rescuer.dbId ?? rescuer.id;
  const firstName = rescuer.first_name ?? rescuer.firstName ?? "";
  const lastName = rescuer.last_name ?? rescuer.lastName ?? "";
  const email = rescuer.email ?? "";
  const phone = rescuer.phone_number ?? rescuer.phone ?? rescuer.unit ?? "";
  const idType = rescuer.id_type ?? rescuer.idType ?? "";
  const idNumber = rescuer.id_number ?? rescuer.idNumber ?? "";
  const idFrontUri = rescuer.id_front_uri ?? rescuer.idFrontUri ?? "";
  const idBackUri = rescuer.id_back_uri ?? rescuer.idBackUri ?? "";
  const isVerified = rescuer.is_verified === 1 || rescuer.isVerified === true;
  const createdAt = rescuer.created_at ?? rescuer.createdAt;
  const hasIdPhotos = Boolean(idFrontUri || idBackUri);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-red-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider font-mono">
              Verify Rescuer Identity
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5 flex-grow select-text">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2 font-mono">
              Submitted ID Photos
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <IdPhoto label="ID Front" src={idFrontUri} />
              <IdPhoto label="ID Back" src={idBackUri} />
            </div>
            {!hasIdPhotos && (
              <p className="mt-2 text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
                No ID photos found for this account. Confirm details carefully before approving.
              </p>
            )}
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3">
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block font-mono">
              Personal & Document Details
            </span>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block">First Name</span>
                <span className="font-semibold text-slate-800">{firstName || "—"}</span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Last Name</span>
                <span className="font-semibold text-slate-800">{lastName || "—"}</span>
              </div>
              <div className="col-span-2 border-t border-slate-200/60 my-1" />
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Email Address</span>
                <span className="font-semibold text-slate-800 font-mono select-all break-all">{email || "—"}</span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Phone Number</span>
                <span className="font-semibold text-slate-800 font-mono select-all">{phone || "No phone number"}</span>
              </div>
              <div className="col-span-2 border-t border-slate-200/60 my-1" />
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block">ID Type</span>
                <span className="font-semibold text-slate-800">{idType || "—"}</span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block">ID Number</span>
                <span className="font-semibold text-slate-800 font-mono">{idNumber || "—"}</span>
              </div>
              <div className="col-span-2 border-t border-slate-200/60 my-1" />
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Status</span>
                <span className={`font-semibold ${isVerified ? "text-emerald-700" : "text-amber-700"}`}>
                  {isVerified ? "Verified" : "Pending Approval"}
                </span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Submitted</span>
                <span className="font-semibold text-slate-800">
                  {createdAt ? new Date(createdAt).toLocaleString() : "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="text-[9.5px] text-slate-500 leading-normal flex items-start gap-1.5 p-2.5 bg-amber-50/50 border border-amber-100 rounded-lg">
            <Info size={12} className="text-amber-600 shrink-0 mt-0.5" />
            <p>
              Compare the ID photos with the name and ID number below. Approve only if the documents look legitimate and match this registration.
            </p>
          </div>
        </div>

        <div className="bg-slate-50 border-t border-slate-100 px-4 py-3 flex gap-2 justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-white border border-slate-200 text-slate-650 hover:bg-slate-50 text-[10px] font-bold uppercase rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>

          <button
            type="button"
            onClick={() => onReject?.(dbId)}
            className="flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-[10px] font-bold uppercase rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 size={10} />
            Reject & Delete
          </button>

          {!isVerified && (
            <button
              type="button"
              onClick={() => onApprove?.(dbId)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all shadow-xs cursor-pointer"
            >
              <CheckCircle size={10} />
              Approve & Verify
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
