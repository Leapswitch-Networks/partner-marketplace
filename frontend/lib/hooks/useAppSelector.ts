import { useSelector, TypedUseSelectorHook } from "react-redux";
import type { RootState } from "@/lib/store";

const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
export default useAppSelector;
